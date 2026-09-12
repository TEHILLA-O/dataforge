import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { LakeBucket } from '../constructs/lake-bucket';
import { DataForgeEnvironment, resourceName } from '../lib/config';

export interface StorageStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
}

export class StorageStack extends cdk.Stack {
  public readonly key: kms.Key;
  public readonly lakeBucket: s3.Bucket;
  public readonly logsBucket: s3.Bucket;
  public readonly athenaResultsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);
    const { forgeEnv } = props;

    this.key = new kms.Key(this, 'Key', {
      alias: `alias/${resourceName(forgeEnv.name, 'lake')}`,
      description: 'DataForge lake, stream and warehouse encryption',
      enableKeyRotation: true,
      removalPolicy: forgeEnv.name === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    this.logsBucket = new s3.Bucket(this, 'Logs', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(90) }],
    });

    const lake = new LakeBucket(this, 'Lake', {
      forgeEnv,
      key: this.key,
      accessLogsBucket: this.logsBucket,
    });
    this.lakeBucket = lake.bucket;

    this.athenaResultsBucket = new s3.Bucket(this, 'AthenaResults', {
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.key,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(7) }],
    });

    new ssm.StringParameter(this, 'LakeBucketParam', {
      parameterName: `/dataforge/${forgeEnv.name}/lake-bucket`,
      stringValue: this.lakeBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'LakeBucketName', { value: this.lakeBucket.bucketName });
    new cdk.CfnOutput(this, 'LakePrefixes', {
      value: 'raw/ bronze/ silver/ gold/ quarantine/',
    });
  }
}
