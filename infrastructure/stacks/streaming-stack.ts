import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as kinesis from 'aws-cdk-lib/aws-kinesis';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEvent from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { TransactionStream } from '../constructs/transaction-stream';
import { DataForgeEnvironment, resourceName } from '../lib/config';
import { StorageStack } from './storage-stack';

export interface StreamingStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly storage: StorageStack;
}

export class StreamingStack extends cdk.Stack {
  public readonly stream: kinesis.Stream;
  public readonly enricher: lambda.IFunction;

  constructor(scope: Construct, id: string, props: StreamingStackProps) {
    super(scope, id, props);
    const { forgeEnv, storage } = props;

    const stream = new TransactionStream(this, 'Transactions', {
      forgeEnv,
      key: storage.key,
    });
    this.stream = stream.stream;

    this.enricher = new NodejsFunction(this, 'Enricher', {
      functionName: resourceName(forgeEnv.name, 'enricher'),
      entry: path.join(__dirname, '..', '..', 'services', 'enrichment', 'handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        LAKE_BUCKET: storage.lakeBucket.bucketName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    storage.lakeBucket.grantWrite(this.enricher);
    storage.key.grantEncryptDecrypt(this.enricher);
    this.stream.grantRead(this.enricher);

    this.enricher.addEventSource(
      new lambdaEvent.KinesisEventSource(this.stream, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 100,
        bisectBatchOnError: true,
        retryAttempts: 3,
      }),
    );

    new ssm.StringParameter(this, 'StreamNameParam', {
      parameterName: `/dataforge/${forgeEnv.name}/stream-name`,
      stringValue: this.stream.streamName,
    });

    new cdk.CfnOutput(this, 'StreamName', { value: this.stream.streamName });
    new cdk.CfnOutput(this, 'StreamArn', { value: this.stream.streamArn });
  }
}
