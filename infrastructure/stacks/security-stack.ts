import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { DataForgeEnvironment } from '../lib/config';
import { StorageStack } from './storage-stack';

export interface SecurityStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly storage: StorageStack;
}

/**
 * Extra guardrails that sit on top of default CDK encryption / SSL settings.
 * Lake Formation column grants live in GovernanceStack; this stack is about
 * identity and transport.
 */
export class SecurityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);
    const { storage } = props;

    storage.lakeBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyInsecureTransport',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:*'],
        resources: [storage.lakeBucket.bucketArn, storage.lakeBucket.arnForObjects('*')],
        conditions: { Bool: { 'aws:SecureTransport': 'false' } },
      }),
    );

    storage.lakeBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'DenyUnencryptedPuts',
        effect: iam.Effect.DENY,
        principals: [new iam.AnyPrincipal()],
        actions: ['s3:PutObject'],
        resources: [storage.lakeBucket.arnForObjects('*')],
        conditions: {
          StringNotEquals: {
            's3:x-amz-server-side-encryption': 'aws:kms',
          },
        },
      }),
    );

    new cdk.CfnOutput(this, 'KmsKeyArn', { value: storage.key.keyArn });
  }
}
