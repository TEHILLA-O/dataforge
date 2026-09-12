import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as kms from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';
import { DataForgeEnvironment, streamName } from '../lib/config';

export interface TransactionStreamProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly key: kms.IKey;
}

export class TransactionStream extends Construct {
  public readonly stream: kinesis.Stream;

  constructor(scope: Construct, id: string, props: TransactionStreamProps) {
    super(scope, id);
    const { forgeEnv, key } = props;

    this.stream = new kinesis.Stream(this, 'Stream', {
      streamName: streamName(forgeEnv.name),
      streamMode: kinesis.StreamMode.ON_DEMAND,
      retentionPeriod: cdk.Duration.hours(forgeEnv.streaming.retentionHours),
      encryption: kinesis.StreamEncryption.KMS,
      encryptionKey: key,
    });
  }
}
