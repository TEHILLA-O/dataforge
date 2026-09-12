import { CloudWatchClient, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { detectAnomalies, MetricWindow } from './index';

const cloudwatch = new CloudWatchClient({});
const sns = new SNSClient({});

export async function handler(): Promise<{ alerts: number }> {
  const stream = process.env.STREAM_NAME;
  const topic = process.env.ALERT_TOPIC_ARN;
  if (!stream || !topic) throw new Error('STREAM_NAME and ALERT_TOPIC_ARN are required');

  const incoming = await metric('AWS/Kinesis', 'IncomingRecords', { StreamName: stream });
  const iteratorAge = await metric('AWS/Kinesis', 'GetRecords.IteratorAgeMilliseconds', { StreamName: stream });

  const windows: MetricWindow[] = [
    { name: 'transaction_count', dataset: 'payments', current: incoming.current, baseline: Math.max(incoming.baseline, 1) },
    { name: 'pipeline_latency_sec', dataset: 'payments', current: iteratorAge.current / 1000, baseline: 1 },
    { name: 'failure_rate', dataset: 'payments', current: 0.03, baseline: 0.03 },
  ];

  const now = new Date();
  const window = `${hhmm(new Date(now.getTime() - 5 * 60_000))}–${hhmm(now)}`;
  const alerts = detectAnomalies(windows, window);

  for (const alert of alerts) {
    const body = [
      'DATAFORGE ANOMALY',
      '',
      `Dataset:`,
      alert.dataset,
      '',
      `Metric:`,
      alert.metric,
      '',
      `Current:`,
      alert.current,
      '',
      `Normal:`,
      alert.normal,
      '',
      `Severity:`,
      alert.severity,
      '',
      `Window:`,
      alert.window,
    ].join('\n');
    await sns.send(new PublishCommand({ TopicArn: topic, Subject: `DataForge ${alert.severity}`, Message: body }));
  }

  return { alerts: alerts.length };
}

async function metric(namespace: string, name: string, dimensions: Record<string, string>) {
  const end = new Date();
  const start = new Date(end.getTime() - 15 * 60_000);
  const result = await cloudwatch.send(
    new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: name,
      Dimensions: Object.entries(dimensions).map(([Name, Value]) => ({ Name, Value })),
      StartTime: start,
      EndTime: end,
      Period: 300,
      Statistics: ['Sum', 'Average'],
    }),
  );
  const points = (result.Datapoints || []).sort((a, b) => (a.Timestamp?.getTime() || 0) - (b.Timestamp?.getTime() || 0));
  const current = points.at(-1)?.Sum ?? points.at(-1)?.Average ?? 0;
  const baseline = points[0]?.Sum ?? points[0]?.Average ?? current;
  return { current, baseline };
}

function hhmm(value: Date): string {
  return value.toISOString().slice(11, 16);
}
