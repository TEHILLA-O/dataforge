export type EnvironmentName = 'dev' | 'stage' | 'prod';

export type Compatibility = 'BACKWARD COMPATIBLE' | 'FORWARD COMPATIBLE' | 'FULLY COMPATIBLE' | 'BREAKING';

export interface DataForgeEnvironment {
  readonly name: EnvironmentName;
  readonly account?: string;
  readonly region: string;
  readonly currency: 'GBP' | 'USD';
  readonly vpc: {
    readonly cidr: string;
    readonly maxAzs: 2;
    readonly natGateways: number;
    readonly enableFlowLogs: boolean;
  };
  readonly streaming: {
    readonly streamMode: 'ON_DEMAND' | 'PROVISIONED';
    readonly shardCount: number;
    readonly retentionHours: number;
    readonly enableGlueStreaming: boolean;
  };
  readonly lake: {
    readonly versioned: boolean;
    readonly retentionDays: number;
    readonly enableIntelligentTiering: boolean;
  };
  readonly analytics: {
    readonly enableAthena: boolean;
    readonly enableRedshift: boolean;
    readonly redshiftBaseCapacityRpu: number;
  };
  readonly governance: {
    readonly enableLakeFormation: boolean;
    readonly enablePiiMasking: boolean;
  };
  readonly cost: {
    readonly monthlyBudget: number;
    readonly autoPauseRedshiftMinutes: number;
  };
  readonly notifyEmail?: string;
}

export const STANDARD_TAGS = {
  Project: 'DataForge',
  Owner: 'Portfolio',
  ManagedBy: 'CDK',
} as const;

export const PERSONAS = [
  'DataEngineer',
  'DataAnalyst',
  'FinanceAnalyst',
  'SecurityAnalyst',
  'Administrator',
  'Auditor',
] as const;

export type Persona = (typeof PERSONAS)[number];

export const PII_COLUMNS = ['email', 'phone', 'ip_address', 'address', 'customer_name'] as const;

export const LAKE_LAYERS = ['raw', 'bronze', 'silver', 'gold', 'quarantine'] as const;

export type LakeLayer = (typeof LAKE_LAYERS)[number];

export const GOLD_DATASETS = [
  'daily_revenue',
  'customer_activity',
  'country_performance',
  'fraud_summary',
  'merchant_statistics',
  'system_performance',
] as const;

export type GoldDataset = (typeof GOLD_DATASETS)[number];

export const SCENARIOS = ['ecommerce', 'payments', 'banking', 'iot', 'logs', 'fraud'] as const;

export type Scenario = (typeof SCENARIOS)[number];
