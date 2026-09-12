import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { DataForgeEnvironment, resourceName } from '../lib/config';

export interface LakeBucketProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly key: kms.IKey;
  readonly accessLogsBucket: s3.IBucket;
}

export class LakeBucket extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: LakeBucketProps) {
    super(scope, id);
    const { forgeEnv, key, accessLogsBucket } = props;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: undefined,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: forgeEnv.lake.versioned,
      removalPolicy: forgeEnv.name === 'dev' ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: forgeEnv.name === 'dev',
      accessControl: s3.BucketAccessControl.PRIVATE,
      serverAccessLogsBucket: accessLogsBucket,
      serverAccessLogsPrefix: 'lake/',
      lifecycleRules: [
        {
          id: 'raw-expire',
          prefix: 'raw/',
          expiration: cdk.Duration.days(forgeEnv.lake.retentionDays),
        },
        {
          id: 'quarantine-expire',
          prefix: 'quarantine/',
          expiration: cdk.Duration.days(Math.min(30, forgeEnv.lake.retentionDays)),
        },
        {
          id: 'gold-transition',
          prefix: 'gold/',
          transitions: forgeEnv.lake.enableIntelligentTiering
            ? [{ storageClass: s3.StorageClass.INTELLIGENT_TIERING, transitionAfter: cdk.Duration.days(30) }]
            : [],
        },
      ],
    });

    cdk.Tags.of(this.bucket).add('Name', resourceName(forgeEnv.name, 'lake'));
  }
}
