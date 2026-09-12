import { DataForgeEnvironment } from './types';

/**
 * Disposable lab. On-demand Kinesis, S3, Lambda, Athena. No always-on Glue
 * streaming job and no Redshift. Safe default for synth, CI and interviews.
 */
export const DEV: DataForgeEnvironment = {
  name: 'dev',
  region: process.env.CDK_DEFAULT_REGION || 'eu-west-2',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  currency: 'GBP',
  vpc: {
    cidr: '10.40.0.0/16',
    maxAzs: 2,
    natGateways: 0,
    enableFlowLogs: false,
  },
  streaming: {
    streamMode: 'ON_DEMAND',
    shardCount: 0,
    retentionHours: 24,
    enableGlueStreaming: false,
  },
  lake: {
    versioned: true,
    retentionDays: 14,
    enableIntelligentTiering: false,
  },
  analytics: {
    enableAthena: true,
    enableRedshift: false,
    redshiftBaseCapacityRpu: 8,
  },
  governance: {
    enableLakeFormation: true,
    enablePiiMasking: true,
  },
  cost: {
    monthlyBudget: 20,
    autoPauseRedshiftMinutes: 5,
  },
  notifyEmail: process.env.DATAFORGE_NOTIFY_EMAIL,
};

/**
 * Pre-prod walkthrough. Adds Glue streaming and a single NAT so Glue can
 * reach Kinesis / Secrets without a public IP. Still no warehouse.
 */
export const STAGE: DataForgeEnvironment = {
  name: 'stage',
  region: process.env.CDK_DEFAULT_REGION || 'eu-west-2',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  currency: 'GBP',
  vpc: {
    cidr: '10.40.0.0/16',
    maxAzs: 2,
    natGateways: 1,
    enableFlowLogs: true,
  },
  streaming: {
    streamMode: 'ON_DEMAND',
    shardCount: 0,
    retentionHours: 48,
    enableGlueStreaming: true,
  },
  lake: {
    versioned: true,
    retentionDays: 30,
    enableIntelligentTiering: true,
  },
  analytics: {
    enableAthena: true,
    enableRedshift: false,
    redshiftBaseCapacityRpu: 8,
  },
  governance: {
    enableLakeFormation: true,
    enablePiiMasking: true,
  },
  cost: {
    monthlyBudget: 45,
    autoPauseRedshiftMinutes: 5,
  },
  notifyEmail: process.env.DATAFORGE_NOTIFY_EMAIL,
};

/**
 * Interview production shape. Glue streaming + Redshift Serverless (pauses
 * when idle). Destroy after the conversation — RPU-hours add up.
 */
export const PROD: DataForgeEnvironment = {
  name: 'prod',
  region: process.env.CDK_DEFAULT_REGION || 'eu-west-2',
  account: process.env.CDK_DEFAULT_ACCOUNT,
  currency: 'GBP',
  vpc: {
    cidr: '10.40.0.0/16',
    maxAzs: 2,
    natGateways: 1,
    enableFlowLogs: true,
  },
  streaming: {
    streamMode: 'ON_DEMAND',
    shardCount: 0,
    retentionHours: 168,
    enableGlueStreaming: true,
  },
  lake: {
    versioned: true,
    retentionDays: 90,
    enableIntelligentTiering: true,
  },
  analytics: {
    enableAthena: true,
    enableRedshift: true,
    redshiftBaseCapacityRpu: 8,
  },
  governance: {
    enableLakeFormation: true,
    enablePiiMasking: true,
  },
  cost: {
    monthlyBudget: 80,
    autoPauseRedshiftMinutes: 5,
  },
  notifyEmail: process.env.DATAFORGE_NOTIFY_EMAIL,
};

export function resolveEnvironment(name?: string): DataForgeEnvironment {
  switch (name) {
    case 'prod':
    case 'production':
    case 'production-demo':
      return PROD;
    case 'stage':
    case 'staging':
      return STAGE;
    case 'dev':
    case 'development':
    default:
      return DEV;
  }
}
