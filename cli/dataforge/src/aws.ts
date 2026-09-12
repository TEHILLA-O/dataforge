import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { KinesisClient, DescribeStreamSummaryCommand, ListShardsCommand } from '@aws-sdk/client-kinesis';
import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from '@aws-sdk/client-athena';
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { PutRecordsCommand, KinesisClient as KinesisPut } from '@aws-sdk/client-kinesis';
import { FinancialEvent } from '../../../services/shared/types';

export interface CliContext {
  env: string;
  region: string;
}

export function stackPrefix(env: string): string {
  if (env === 'prod' || env === 'production' || env === 'production-demo') return 'DataForgeProd';
  if (env === 'stage' || env === 'staging') return 'DataForgeStage';
  return 'DataForgeDev';
}

export async function parameter(ctx: CliContext, key: string): Promise<string | undefined> {
  const ssm = new SSMClient({ region: ctx.region });
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: `/dataforge/${ctx.env}/${key}` }));
    return result.Parameter?.Value;
  } catch {
    return undefined;
  }
}

export async function stackOutputs(ctx: CliContext, suffix: string): Promise<Record<string, string>> {
  const cfn = new CloudFormationClient({ region: ctx.region });
  const result = await cfn.send(new DescribeStacksCommand({ StackName: `${stackPrefix(ctx.env)}-${suffix}` }));
  const outputs: Record<string, string> = {};
  for (const out of result.Stacks?.[0]?.Outputs || []) {
    if (out.OutputKey && out.OutputValue) outputs[out.OutputKey] = out.OutputValue;
  }
  return outputs;
}

export async function describeStream(ctx: CliContext, streamName: string) {
  const kinesis = new KinesisClient({ region: ctx.region });
  const summary = await kinesis.send(new DescribeStreamSummaryCommand({ StreamName: streamName }));
  const shards = await kinesis.send(new ListShardsCommand({ StreamName: streamName }));
  return {
    status: summary.StreamDescriptionSummary?.StreamStatus || 'UNKNOWN',
    shards: shards.Shards?.length || summary.StreamDescriptionSummary?.OpenShardCount || 0,
    arn: summary.StreamDescriptionSummary?.StreamARN,
  };
}

export async function streamMetrics(ctx: CliContext, streamName: string) {
  const cw = new CloudWatchClient({ region: ctx.region });
  const end = new Date();
  const start = new Date(end.getTime() - 5 * 60_000);
  const incoming = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: 'AWS/Kinesis',
      MetricName: 'IncomingRecords',
      Dimensions: [{ Name: 'StreamName', Value: streamName }],
      StartTime: start,
      EndTime: end,
      Period: 60,
      Statistics: ['Sum'],
    }),
  );
  const bytes = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: 'AWS/Kinesis',
      MetricName: 'IncomingBytes',
      Dimensions: [{ Name: 'StreamName', Value: streamName }],
      StartTime: start,
      EndTime: end,
      Period: 60,
      Statistics: ['Sum'],
    }),
  );
  const age = await cw.send(
    new GetMetricStatisticsCommand({
      Namespace: 'AWS/Kinesis',
      MetricName: 'GetRecords.IteratorAgeMilliseconds',
      Dimensions: [{ Name: 'StreamName', Value: streamName }],
      StartTime: start,
      EndTime: end,
      Period: 60,
      Statistics: ['Maximum'],
    }),
  );
  const latest = (points?: { Timestamp?: Date; Sum?: number; Maximum?: number }[]) =>
    (points || []).sort((a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0)).at(-1);
  return {
    incomingRecords: latest(incoming.Datapoints)?.Sum || 0,
    incomingBytes: latest(bytes.Datapoints)?.Sum || 0,
    iteratorAge: latest(age.Datapoints)?.Maximum || 0,
  };
}

export async function putRecords(ctx: CliContext, streamName: string, events: FinancialEvent[], partitionKey: (e: FinancialEvent) => string) {
  const kinesis = new KinesisPut({ region: ctx.region });
  let failed = 0;
  for (let i = 0; i < events.length; i += 500) {
    const chunk = events.slice(i, i + 500);
    const result = await kinesis.send(
      new PutRecordsCommand({
        StreamName: streamName,
        Records: chunk.map((event) => ({
          Data: Buffer.from(JSON.stringify(event)),
          PartitionKey: partitionKey(event).slice(0, 256),
        })),
      }),
    );
    failed += result.FailedRecordCount || 0;
  }
  return { sent: events.length, failed };
}

export async function runAthena(ctx: CliContext, sql: string, database: string, output: string) {
  const athena = new AthenaClient({ region: ctx.region });
  const started = await athena.send(
    new StartQueryExecutionCommand({
      QueryString: sql,
      QueryExecutionContext: { Database: database },
      ResultConfiguration: { OutputLocation: output },
    }),
  );
  const id = started.QueryExecutionId;
  if (!id) throw new Error('Athena did not return a query id');
  for (let i = 0; i < 40; i++) {
    const exec = await athena.send(new GetQueryExecutionCommand({ QueryExecutionId: id }));
    const state = exec.QueryExecution?.Status?.State;
    if (state === 'SUCCEEDED') break;
    if (state === 'FAILED' || state === 'CANCELLED') {
      throw new Error(exec.QueryExecution?.Status?.StateChangeReason || `Athena ${state}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  const results = await athena.send(new GetQueryResultsCommand({ QueryExecutionId: id }));
  const rows = (results.ResultSet?.Rows || []).map((row) => (row.Data || []).map((col) => col.VarCharValue || ''));
  return rows;
}

export async function monthToDateCost(ctx: CliContext): Promise<string> {
  const ce = new CostExplorerClient({ region: 'us-east-1' });
  const now = new Date();
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const end = now.toISOString().slice(0, 10);
  const result = await ce.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: start, End: end },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      Filter: {
        Tags: { Key: 'Project', Values: ['DataForge'] },
      },
    }),
  );
  const amount = result.ResultsByTime?.[0]?.Total?.UnblendedCost?.Amount;
  const unit = result.ResultsByTime?.[0]?.Total?.UnblendedCost?.Unit || 'USD';
  return amount ? `${Number(amount).toFixed(2)} ${unit}` : 'n/a (Cost Explorer lags ~24h)';
}
