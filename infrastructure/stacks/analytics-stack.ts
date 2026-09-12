import * as cdk from 'aws-cdk-lib';
import * as athena from 'aws-cdk-lib/aws-athena';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as redshiftserverless from 'aws-cdk-lib/aws-redshiftserverless';
import { Construct } from 'constructs';
import { catalogDatabase, DataForgeEnvironment, resourceName } from '../lib/config';
import { NetworkStack } from './network-stack';
import { StorageStack } from './storage-stack';

export interface AnalyticsStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
  readonly storage: StorageStack;
  readonly network: NetworkStack;
}

export class AnalyticsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AnalyticsStackProps) {
    super(scope, id, props);
    const { forgeEnv, storage, network } = props;

    if (forgeEnv.analytics.enableAthena) {
      new athena.CfnWorkGroup(this, 'WorkGroup', {
        name: resourceName(forgeEnv.name, 'athena'),
        description: 'DataForge lake queries',
        workGroupConfiguration: {
          enforceWorkGroupConfiguration: true,
          publishCloudWatchMetricsEnabled: true,
          resultConfiguration: {
            outputLocation: `s3://${storage.athenaResultsBucket.bucketName}/results/`,
            encryptionConfiguration: { encryptionOption: 'SSE_KMS', kmsKey: storage.key.keyArn },
          },
        },
      });

      new athena.CfnNamedQuery(this, 'CountryVolume', {
        database: catalogDatabase(forgeEnv.name, 'gold'),
        name: 'country-volume',
        workGroup: resourceName(forgeEnv.name, 'athena'),
        queryString: [
          'SELECT country, COUNT(*) AS transactions, SUM(volume) AS volume',
          `FROM ${catalogDatabase(forgeEnv.name, 'gold')}.country_performance`,
          'GROUP BY country',
          'ORDER BY volume DESC;',
        ].join('\n'),
      });
    }

    if (forgeEnv.analytics.enableRedshift) {
      const role = new iam.Role(this, 'RedshiftRole', {
        assumedBy: new iam.ServicePrincipal('redshift.amazonaws.com'),
        description: 'Redshift Serverless COPY from the DataForge lake',
      });
      storage.lakeBucket.grantRead(role);
      storage.key.grantDecrypt(role);

      const namespace = new redshiftserverless.CfnNamespace(this, 'Namespace', {
        namespaceName: resourceName(forgeEnv.name, 'warehouse').replace(/-/g, ''),
        dbName: 'dataforge',
        defaultIamRoleArn: role.roleArn,
        iamRoles: [role.roleArn],
        kmsKeyId: storage.key.keyArn,
      });

      const workgroup = new redshiftserverless.CfnWorkgroup(this, 'Workgroup', {
        workgroupName: resourceName(forgeEnv.name, 'wg').replace(/-/g, ''),
        namespaceName: namespace.namespaceName,
        baseCapacity: forgeEnv.analytics.redshiftBaseCapacityRpu,
        maxCapacity: forgeEnv.analytics.redshiftBaseCapacityRpu,
        publiclyAccessible: false,
        subnetIds: network.isolatedSubnetIds,
        securityGroupIds: [network.redshiftSecurityGroup.securityGroupId],
      });
      workgroup.addResourceDependency(namespace);

      new cdk.CfnOutput(this, 'RedshiftWorkgroup', { value: workgroup.workgroupName });
    } else {
      new cdk.CfnOutput(this, 'RedshiftWorkgroup', { value: 'disabled' });
    }

  }
}
