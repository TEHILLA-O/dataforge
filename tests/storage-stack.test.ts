import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DEV } from '../infrastructure/lib/config';
import { StorageStack } from '../infrastructure/stacks/storage-stack';

describe('storage stack', () => {
  it('creates a KMS-encrypted lake with public access blocked', () => {
    const app = new cdk.App();
    const stack = new StorageStack(app, 'TestStorage', {
      forgeEnv: { ...DEV, account: '000000000000' },
      env: { account: '000000000000', region: 'eu-west-2' },
    });
    const template = Template.fromStack(stack);
    template.resourceCountIs('AWS::KMS::Key', 1);
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });
});
