import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { GlueEtlJob } from '../constructs/glue-etl-job';
import { catalogDatabase, DataForgeEnvironment, LAKE_LAYERS, resourceName } from '../lib/config';
import { StorageStack } from './storage-stack';
import { StreamingStack } from './streaming-stack';

export interface GlueStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly storage: StorageStack;
  readonly streaming: StreamingStack;
}

export class GlueStack extends cdk.Stack {
  public readonly role: iam.Role;
  public readonly databases: glue.CfnDatabase[] = [];

  constructor(scope: Construct, id: string, props: GlueStackProps) {
    super(scope, id, props);
    const { forgeEnv, storage, streaming } = props;

    this.role = new iam.Role(this, 'GlueRole', {
      roleName: resourceName(forgeEnv.name, 'glue'),
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole')],
    });
    storage.lakeBucket.grantReadWrite(this.role);
    storage.key.grantEncryptDecrypt(this.role);
    streaming.stream.grantRead(this.role);

    for (const layer of LAKE_LAYERS) {
      if (layer === 'quarantine') continue;
      const db = new glue.CfnDatabase(this, `Db${capitalize(layer)}`, {
        catalogId: this.account,
        databaseInput: {
          name: catalogDatabase(forgeEnv.name, layer),
          description: `DataForge ${layer} layer`,
          locationUri: `s3://${storage.lakeBucket.bucketName}/${layer}/`,
        },
      });
      this.databases.push(db);
    }

    const rawDb = this.databases[0];
    const bronzeDb = this.databases[1];
    const silverDb = this.databases[2];
    const goldDb = this.databases[3];
    this.table('RawTransactions', catalogDatabase(forgeEnv.name, 'raw'), 'transactions', storage.lakeBucket.bucketName, 'raw/transactions/', 'json').addResourceDependency(rawDb);
    this.table('BronzeTransactions', catalogDatabase(forgeEnv.name, 'bronze'), 'transactions', storage.lakeBucket.bucketName, 'bronze/transactions/', 'parquet').addResourceDependency(bronzeDb);
    this.table('SilverTransactions', catalogDatabase(forgeEnv.name, 'silver'), 'transactions', storage.lakeBucket.bucketName, 'silver/transactions/', 'parquet').addResourceDependency(silverDb);
    this.goldTable('daily_revenue', catalogDatabase(forgeEnv.name, 'gold'), storage.lakeBucket.bucketName).addResourceDependency(goldDb);
    this.goldTable('customer_activity', catalogDatabase(forgeEnv.name, 'gold'), storage.lakeBucket.bucketName).addResourceDependency(goldDb);
    this.goldTable('country_performance', catalogDatabase(forgeEnv.name, 'gold'), storage.lakeBucket.bucketName).addResourceDependency(goldDb);
    this.goldTable('fraud_summary', catalogDatabase(forgeEnv.name, 'gold'), storage.lakeBucket.bucketName).addResourceDependency(goldDb);
    this.goldTable('merchant_statistics', catalogDatabase(forgeEnv.name, 'gold'), storage.lakeBucket.bucketName).addResourceDependency(goldDb);
    this.goldTable('system_performance', catalogDatabase(forgeEnv.name, 'gold'), storage.lakeBucket.bucketName).addResourceDependency(goldDb);

    const defaults = {
      '--LAKE_BUCKET': storage.lakeBucket.bucketName,
      '--STREAM_NAME': streaming.stream.streamName,
      '--ENV': forgeEnv.name,
    };

    new GlueEtlJob(this, 'BronzeToSilver', {
      forgeEnv,
      name: 'bronze-to-silver',
      scriptPath: path.join('glue', 'batch', 'bronze_to_silver.py'),
      role: this.role,
      defaultArguments: defaults,
    });

    new GlueEtlJob(this, 'SilverToGold', {
      forgeEnv,
      name: 'silver-to-gold',
      scriptPath: path.join('glue', 'batch', 'silver_to_gold.py'),
      role: this.role,
      defaultArguments: defaults,
    });

    new GlueEtlJob(this, 'QualityScan', {
      forgeEnv,
      name: 'quality-scan',
      scriptPath: path.join('glue', 'batch', 'quality_scan.py'),
      role: this.role,
      defaultArguments: defaults,
    });

    if (forgeEnv.streaming.enableGlueStreaming) {
      new GlueEtlJob(this, 'StreamingTransactions', {
        forgeEnv,
        name: 'streaming-transactions',
        scriptPath: path.join('glue', 'streaming', 'transactions.py'),
        role: this.role,
        streaming: true,
        defaultArguments: defaults,
      });
    }

    new cdk.CfnOutput(this, 'GlueRoleArn', { value: this.role.roleArn });
  }

  private table(id: string, database: string, name: string, bucket: string, prefix: string, format: 'json' | 'parquet') {
    return new glue.CfnTable(this, id, {
      catalogId: this.account,
      databaseName: database,
      tableInput: {
        name,
        tableType: 'EXTERNAL_TABLE',
        parameters: {
          classification: format,
          'projection.enabled': 'true',
          'projection.year.type': 'integer',
          'projection.year.range': '2024,2030',
          'projection.month.type': 'integer',
          'projection.month.range': '1,12',
          'projection.month.digits': '2',
          'projection.day.type': 'integer',
          'projection.day.range': '1,31',
          'projection.day.digits': '2',
          'projection.hour.type': 'integer',
          'projection.hour.range': '0,23',
          'projection.hour.digits': '2',
          'storage.location.template': `s3://${bucket}/${prefix}year=\${year}/month=\${month}/day=\${day}/hour=\${hour}/`,
        },
        partitionKeys: [
          { name: 'year', type: 'string' },
          { name: 'month', type: 'string' },
          { name: 'day', type: 'string' },
          { name: 'hour', type: 'string' },
        ],
        storageDescriptor: {
          location: `s3://${bucket}/${prefix}`,
          inputFormat:
            format === 'parquet'
              ? 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat'
              : 'org.apache.hadoop.mapred.TextInputFormat',
          outputFormat:
            format === 'parquet'
              ? 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat'
              : 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary:
              format === 'parquet'
                ? 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe'
                : 'org.openx.data.jsonserde.JsonSerDe',
          },
          columns: transactionColumns(),
        },
      },
    });
  }

  private goldTable(name: string, database: string, bucket: string) {
    return new glue.CfnTable(this, `Gold${pascal(name)}`, {
      catalogId: this.account,
      databaseName: database,
      tableInput: {
        name,
        tableType: 'EXTERNAL_TABLE',
        parameters: { classification: 'parquet' },
        storageDescriptor: {
          location: `s3://${bucket}/gold/${name}/`,
          inputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat',
          outputFormat: 'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe',
          },
          columns: [
            { name: 'metric_date', type: 'string' },
            { name: 'transactions', type: 'bigint' },
            { name: 'volume', type: 'double' },
          ],
        },
      },
    });
  }
}

function transactionColumns() {
  return [
    { name: 'event_id', type: 'string' },
    { name: 'customer_id', type: 'string' },
    { name: 'event_type', type: 'string' },
    { name: 'amount', type: 'double' },
    { name: 'currency', type: 'string' },
    { name: 'country', type: 'string' },
    { name: 'device', type: 'string' },
    { name: 'timestamp', type: 'string' },
    { name: 'merchant_id', type: 'string' },
    { name: 'merchant_category', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'phone', type: 'string' },
    { name: 'ip_address', type: 'string' },
    { name: 'customer_name', type: 'string' },
    { name: 'address', type: 'string' },
    { name: 'risk_score', type: 'double' },
    { name: 'country_name', type: 'string' },
    { name: 'amount_gbp', type: 'double' },
    { name: 'is_fraud', type: 'boolean' },
  ];
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pascal(value: string): string {
  return value
    .split('_')
    .map((part) => capitalize(part))
    .join('');
}
