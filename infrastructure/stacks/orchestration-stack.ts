import * as fs from 'fs';
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';
import { DataForgeEnvironment, resourceName } from '../lib/config';
import { GlueStack } from './glue-stack';
import { StorageStack } from './storage-stack';

export interface OrchestrationStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly storage: StorageStack;
  readonly glue: GlueStack;
}

export class OrchestrationStack extends cdk.Stack {
  public readonly stateMachine: sfn.CfnStateMachine;

  constructor(scope: Construct, id: string, props: OrchestrationStackProps) {
    super(scope, id, props);
    const { forgeEnv, storage, glue } = props;

    const definition = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', '..', 'workflows', 'batch-pipeline', 'definition.asl.json'), 'utf8'),
    ) as Record<string, unknown>;

    const role = new iam.Role(this, 'SfnRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
    });
    glue.role.grantPassRole(role);
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['glue:StartJobRun', 'glue:GetJobRun', 'glue:GetJobRuns'],
        resources: ['*'],
      }),
    );
    storage.lakeBucket.grantReadWrite(role);

    this.stateMachine = new sfn.CfnStateMachine(this, 'BatchPipeline', {
      stateMachineName: resourceName(forgeEnv.name, 'batch-pipeline'),
      roleArn: role.roleArn,
      definitionString: JSON.stringify(definition),
      stateMachineType: 'STANDARD',
    });

    new cdk.CfnOutput(this, 'BatchStateMachine', { value: this.stateMachine.attrArn });
  }
}
