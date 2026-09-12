import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { Persona, resourceName } from '../lib/config';
import { DataForgeEnvironment } from '../lib/config';

export interface PersonaRoleProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly persona: Persona;
  readonly lakeBucketArn: string;
}

const DESCRIPTIONS: Record<Persona, string> = {
  DataEngineer: 'Builds and operates the lake, Glue jobs and schemas',
  DataAnalyst: 'Reads silver/gold after PII masking',
  FinanceAnalyst: 'Column-limited gold access for revenue reporting',
  SecurityAnalyst: 'Reads quarantine, fraud and audit tables',
  Administrator: 'Unmasked operational access',
  Auditor: 'Read-only lineage, quality and gold',
};

export class PersonaRole extends Construct {
  public readonly role: iam.Role;

  constructor(scope: Construct, id: string, props: PersonaRoleProps) {
    super(scope, id);
    this.role = new iam.Role(this, 'Role', {
      roleName: resourceName(props.forgeEnv.name, props.persona.toLowerCase()),
      assumedBy: new iam.AccountRootPrincipal(),
      description: DESCRIPTIONS[props.persona],
    });

    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'LakeRead',
        actions: ['s3:GetObject', 's3:ListBucket', 's3:GetBucketLocation'],
        resources: [props.lakeBucketArn, `${props.lakeBucketArn}/*`],
      }),
    );
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'CatalogRead',
        actions: ['glue:GetDatabase', 'glue:GetTable', 'glue:GetTables', 'glue:GetPartitions'],
        resources: ['*'],
      }),
    );
  }
}
