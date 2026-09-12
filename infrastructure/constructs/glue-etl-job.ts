import * as path from 'path';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import { Construct } from 'constructs';
import { DataForgeEnvironment, resourceName } from '../lib/config';

export interface GlueEtlJobProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly name: string;
  readonly scriptPath: string;
  readonly role: iam.IRole;
  readonly streaming?: boolean;
  readonly defaultArguments?: Record<string, string>;
}

export class GlueEtlJob extends Construct {
  public readonly job: glue.CfnJob;
  public readonly script: s3assets.Asset;

  constructor(scope: Construct, id: string, props: GlueEtlJobProps) {
    super(scope, id);
    this.script = new s3assets.Asset(this, 'Script', {
      path: path.isAbsolute(props.scriptPath) ? props.scriptPath : path.join(__dirname, '..', '..', props.scriptPath),
    });
    this.script.grantRead(props.role);

    this.job = new glue.CfnJob(this, 'Job', {
      name: resourceName(props.forgeEnv.name, props.name),
      role: props.role.roleArn,
      command: {
        name: props.streaming ? 'gluestreaming' : 'glueetl',
        pythonVersion: '3',
        scriptLocation: this.script.s3ObjectUrl,
      },
      glueVersion: '4.0',
      workerType: props.forgeEnv.name === 'dev' ? 'G.1X' : 'G.1X',
      numberOfWorkers: props.streaming ? 2 : 2,
      maxRetries: 1,
      timeout: props.streaming ? 120 : 30,
      executionProperty: { maxConcurrentRuns: 1 },
      defaultArguments: {
        '--job-language': 'python',
        '--enable-metrics': 'true',
        '--enable-continuous-cloudwatch-log': 'true',
        '--enable-glue-datacatalog': 'true',
        ...props.defaultArguments,
      },
    });
  }
}
