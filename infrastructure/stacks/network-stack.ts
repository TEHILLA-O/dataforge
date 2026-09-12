import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { DataForgeEnvironment } from '../lib/config';

export interface NetworkStackProps extends cdk.StackProps {
  readonly forgeEnv: DataForgeEnvironment;
}

/**
 * Two-AZ VPC for Glue (stage/prod) and Redshift Serverless (prod).
 *
 *   10.40.0.0/16
 *     Public        10.40.1.0/24  10.40.2.0/24
 *     Private app   10.40.11.0/24 10.40.12.0/24   Glue
 *     Isolated      10.40.21.0/24 10.40.22.0/24   Redshift
 *
 * Dev ships zero NAT. S3/DynamoDB gateway endpoints still let private
 * workloads reach the lake without a public address.
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly isolatedSubnetIds: string[];
  public readonly glueSecurityGroup: ec2.SecurityGroup;
  public readonly redshiftSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);
    const { forgeEnv } = props;
    const azs = cdk.Fn.getAzs();
    const azA = cdk.Fn.select(0, azs);
    const azB = cdk.Fn.select(1, azs);

    const cfnVpc = new ec2.CfnVPC(this, 'Vpc', {
      cidrBlock: forgeEnv.vpc.cidr,
      enableDnsHostnames: true,
      enableDnsSupport: true,
      tags: [{ key: 'Name', value: `${forgeEnv.name}-dataforge-vpc` }],
    });

    const igw = new ec2.CfnInternetGateway(this, 'InternetGateway', {
      tags: [{ key: 'Name', value: `${forgeEnv.name}-dataforge-igw` }],
    });
    const igwAttach = new ec2.CfnVPCGatewayAttachment(this, 'IgwAttachment', {
      vpcId: cfnVpc.ref,
      internetGatewayId: igw.ref,
    });

    const publicA = this.publicSubnet('PublicA', cfnVpc.ref, azA, '10.40.1.0/24', `${forgeEnv.name}-public-a`);
    const publicB = this.publicSubnet('PublicB', cfnVpc.ref, azB, '10.40.2.0/24', `${forgeEnv.name}-public-b`);
    this.defaultRouteToIgw('PublicADefault', publicA.routeTable.ref, igw.ref, igwAttach);
    this.defaultRouteToIgw('PublicBDefault', publicB.routeTable.ref, igw.ref, igwAttach);

    const natCount = Math.max(0, Math.min(2, forgeEnv.vpc.natGateways));
    const natA = natCount > 0 ? this.natGateway('NatA', publicA.subnet.ref, `${forgeEnv.name}-nat-a`) : undefined;
    const natB = natCount > 1 ? this.natGateway('NatB', publicB.subnet.ref, `${forgeEnv.name}-nat-b`) : natA;

    const appA = this.privateSubnet('AppA', cfnVpc.ref, azA, '10.40.11.0/24', `${forgeEnv.name}-glue-a`);
    const appB = this.privateSubnet('AppB', cfnVpc.ref, azB, '10.40.12.0/24', `${forgeEnv.name}-glue-b`);
    if (natA) this.defaultRouteToNat('AppADefault', appA.routeTable.ref, natA.ref);
    if (natB) this.defaultRouteToNat('AppBDefault', appB.routeTable.ref, natB.ref);

    const dataA = this.privateSubnet('DataA', cfnVpc.ref, azA, '10.40.21.0/24', `${forgeEnv.name}-warehouse-a`);
    const dataB = this.privateSubnet('DataB', cfnVpc.ref, azB, '10.40.22.0/24', `${forgeEnv.name}-warehouse-b`);

    this.isolatedSubnetIds = [dataA.subnet.ref, dataB.subnet.ref];

    this.vpc = ec2.Vpc.fromVpcAttributes(this, 'VpcRef', {
      vpcId: cfnVpc.ref,
      vpcCidrBlock: forgeEnv.vpc.cidr,
      availabilityZones: [azA, azB],
      publicSubnetIds: [publicA.subnet.ref, publicB.subnet.ref],
      privateSubnetIds: [appA.subnet.ref, appB.subnet.ref],
      isolatedSubnetIds: [dataA.subnet.ref, dataB.subnet.ref],
    });

    this.gatewayEndpoint('S3Endpoint', cfnVpc.ref, 's3', [
      appA.routeTable.ref,
      appB.routeTable.ref,
      dataA.routeTable.ref,
      dataB.routeTable.ref,
    ]);
    this.gatewayEndpoint('DynamoEndpoint', cfnVpc.ref, 'dynamodb', [appA.routeTable.ref, appB.routeTable.ref]);

    this.glueSecurityGroup = new ec2.SecurityGroup(this, 'GlueSg', {
      vpc: this.vpc,
      description: 'Glue streaming / batch workers',
      allowAllOutbound: true,
    });
    this.glueSecurityGroup.addIngressRule(this.glueSecurityGroup, ec2.Port.allTcp(), 'Glue self-referencing');

    this.redshiftSecurityGroup = new ec2.SecurityGroup(this, 'RedshiftSg', {
      vpc: this.vpc,
      description: 'Redshift Serverless',
      allowAllOutbound: true,
    });
    this.redshiftSecurityGroup.addIngressRule(this.glueSecurityGroup, ec2.Port.tcp(5439), 'Glue to Redshift');

    new cdk.CfnOutput(this, 'VpcId', { value: cfnVpc.ref });
  }

  private publicSubnet(id: string, vpcId: string, az: string, cidr: string, name: string) {
    const subnet = new ec2.CfnSubnet(this, `${id}Subnet`, {
      vpcId,
      availabilityZone: az,
      cidrBlock: cidr,
      mapPublicIpOnLaunch: true,
      tags: [{ key: 'Name', value: name }],
    });
    const routeTable = new ec2.CfnRouteTable(this, `${id}Routes`, {
      vpcId,
      tags: [{ key: 'Name', value: `${name}-rt` }],
    });
    new ec2.CfnSubnetRouteTableAssociation(this, `${id}Assoc`, {
      subnetId: subnet.ref,
      routeTableId: routeTable.ref,
    });
    return { subnet, routeTable };
  }

  private privateSubnet(id: string, vpcId: string, az: string, cidr: string, name: string) {
    const subnet = new ec2.CfnSubnet(this, `${id}Subnet`, {
      vpcId,
      availabilityZone: az,
      cidrBlock: cidr,
      mapPublicIpOnLaunch: false,
      tags: [{ key: 'Name', value: name }],
    });
    const routeTable = new ec2.CfnRouteTable(this, `${id}Routes`, {
      vpcId,
      tags: [{ key: 'Name', value: `${name}-rt` }],
    });
    new ec2.CfnSubnetRouteTableAssociation(this, `${id}Assoc`, {
      subnetId: subnet.ref,
      routeTableId: routeTable.ref,
    });
    return { subnet, routeTable };
  }

  private defaultRouteToIgw(id: string, routeTableId: string, gatewayId: string, attach: ec2.CfnVPCGatewayAttachment) {
    const route = new ec2.CfnRoute(this, id, {
      routeTableId,
      destinationCidrBlock: '0.0.0.0/0',
      gatewayId,
    });
    route.addResourceDependency(attach);
  }

  private defaultRouteToNat(id: string, routeTableId: string, natGatewayId: string) {
    new ec2.CfnRoute(this, id, {
      routeTableId,
      destinationCidrBlock: '0.0.0.0/0',
      natGatewayId,
    });
  }

  private natGateway(id: string, subnetId: string, name: string) {
    const eip = new ec2.CfnEIP(this, `${id}Eip`, { domain: 'vpc' });
    return new ec2.CfnNatGateway(this, id, {
      subnetId,
      allocationId: eip.attrAllocationId,
      tags: [{ key: 'Name', value: name }],
    });
  }

  private gatewayEndpoint(id: string, vpcId: string, service: 's3' | 'dynamodb', routeTableIds: string[]) {
    new ec2.CfnVPCEndpoint(this, id, {
      vpcId,
      serviceName: cdk.Fn.sub(`com.amazonaws.\${AWS::Region}.${service}`),
      routeTableIds,
    });
  }
}
