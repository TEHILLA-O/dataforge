import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lf from 'aws-cdk-lib/aws-lakeformation';
import { Construct } from 'constructs';
import { PersonaRole } from '../constructs/persona-role';
import { catalogDatabase, DataForgeEnvironment, PERSONAS, Persona, PII_COLUMNS } from '../lib/config';
import { GlueStack } from './glue-stack';
import { StorageStack } from './storage-stack';

export interface GovernanceStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly storage: StorageStack;
  readonly glue: GlueStack;
}

export class GovernanceStack extends cdk.Stack {
  public readonly personas: Record<Persona, iam.IRole>;

  constructor(scope: Construct, id: string, props: GovernanceStackProps) {
    super(scope, id, props);
    const { forgeEnv, storage, glue } = props;
    this.personas = {} as Record<Persona, iam.IRole>;

    for (const persona of PERSONAS) {
      const constructed = new PersonaRole(this, persona, {
        forgeEnv,
        persona,
        lakeBucketArn: storage.lakeBucket.bucketArn,
      });
      this.personas[persona] = constructed.role;
    }

    this.personas.DataEngineer.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject', 'glue:CreateTable', 'glue:UpdateTable', 'glue:StartJobRun'],
        resources: ['*'],
      }),
    );

    if (!forgeEnv.governance.enableLakeFormation) {
      new cdk.CfnOutput(this, 'LakeFormation', { value: 'disabled' });
      return;
    }

    new lf.CfnResource(this, 'RegisteredLake', {
      resourceArn: storage.lakeBucket.bucketArn,
      useServiceLinkedRole: true,
    });

    new lf.CfnDataLakeSettings(this, 'Settings', {
      admins: [{ dataLakePrincipalIdentifier: this.personas.Administrator.roleArn }],
      createDatabaseDefaultPermissions: [],
      createTableDefaultPermissions: [],
    });

    this.grantDatabase('EngineerRaw', this.personas.DataEngineer, catalogDatabase(forgeEnv.name, 'raw'), ['ALL']);
    this.grantDatabase('EngineerBronze', this.personas.DataEngineer, catalogDatabase(forgeEnv.name, 'bronze'), ['ALL']);
    this.grantDatabase('EngineerSilver', this.personas.DataEngineer, catalogDatabase(forgeEnv.name, 'silver'), ['ALL']);
    this.grantDatabase('EngineerGold', this.personas.DataEngineer, catalogDatabase(forgeEnv.name, 'gold'), ['SELECT']);

    this.grantDatabase('AnalystSilver', this.personas.DataAnalyst, catalogDatabase(forgeEnv.name, 'silver'), ['SELECT']);
    this.grantDatabase('AnalystGold', this.personas.DataAnalyst, catalogDatabase(forgeEnv.name, 'gold'), ['SELECT']);

    this.grantDatabase('AuditorGold', this.personas.Auditor, catalogDatabase(forgeEnv.name, 'gold'), ['SELECT']);
    this.grantDatabase('SecurityGold', this.personas.SecurityAnalyst, catalogDatabase(forgeEnv.name, 'gold'), ['SELECT']);

    new lf.CfnPermissions(this, 'FinanceGoldColumns', {
      dataLakePrincipal: { dataLakePrincipalIdentifier: this.personas.FinanceAnalyst.roleArn },
      resource: {
        tableWithColumnsResource: {
          catalogId: this.account,
          databaseName: catalogDatabase(forgeEnv.name, 'gold'),
          name: 'country_performance',
          columnNames: ['country', 'transactions', 'volume'],
        },
      },
      permissions: ['SELECT'],
    });

    new cdk.CfnOutput(this, 'PiiColumns', { value: PII_COLUMNS.join(',') });
    new cdk.CfnOutput(this, 'FinanceDeniedColumns', { value: 'email,ip_address,phone,customer_name,address' });
    void glue;
  }

  private grantDatabase(id: string, role: iam.IRole, databaseName: string, permissions: string[]) {
    new lf.CfnPermissions(this, id, {
      dataLakePrincipal: { dataLakePrincipalIdentifier: role.roleArn },
      resource: {
        databaseResource: { catalogId: this.account, name: databaseName },
      },
      permissions,
    });
  }
}
