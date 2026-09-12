import { Scenario } from '../../infrastructure/lib/config';

export type { Scenario };

export const EVENT_TYPES = [
  'payment',
  'refund',
  'login',
  'logout',
  'transfer',
  'card_auth',
  'chargeback',
  'signup',
  'telemetry',
  'log',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const CURRENCIES = ['GBP', 'EUR', 'USD', 'JPY'] as const;
export const COUNTRIES = ['GB', 'IE', 'FR', 'DE', 'US', 'NL', 'ES', 'IT', 'SE', 'NO'] as const;
export const DEVICES = ['mobile', 'web', 'pos', 'atm', 'iot'] as const;
export const MERCHANT_CATEGORIES = [
  'electronics',
  'groceries',
  'travel',
  'fuel',
  'restaurants',
  'healthcare',
  'entertainment',
] as const;

export interface FinancialEvent {
  event_id: string;
  customer_id?: string;
  event_type: string;
  amount?: number;
  currency?: string;
  country?: string;
  device?: string;
  timestamp: string;
  merchant_id?: string;
  merchant_category?: string;
  email?: string;
  phone?: string;
  ip_address?: string;
  customer_name?: string;
  address?: string;
  device_id?: string;
  service?: string;
  level?: string;
  message?: string;
  schema_version: number;
  risk_score?: number;
  ingested_at?: string;
  _defect?: string;
}

export interface GenerateOptions {
  scenario: Scenario;
  rate: number;
  durationMs: number;
  seed?: number;
  sink: 'local' | 'kinesis' | 'stdout';
  processLake?: boolean;
}

export interface StreamSnapshot {
  stream: string;
  status: string;
  shards: number;
  incomingRecordsPerSec: number;
  incomingBytesPerSec: number;
  iteratorAgeMs: number;
  failedRecords: number;
  lastMinuteEvents: number;
}

export interface QualityIssue {
  code: string;
  field: string;
  count: number;
  sample?: string;
}

export interface QualityReport {
  dataset: string;
  records: number;
  completeness: number;
  validity: number;
  uniqueness: number;
  issues: QualityIssue[];
  quarantined: number;
  score: number;
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  pii?: boolean;
  description?: string;
}

export interface SchemaVersion {
  name: string;
  version: number;
  fields: SchemaField[];
}

export interface SchemaDiff {
  left: string;
  right: string;
  added: SchemaField[];
  removed: SchemaField[];
  changed: Array<{ name: string; from: string; to: string }>;
  compatibility: import('../../infrastructure/lib/config').Compatibility;
}

export interface LineageNode {
  id: string;
  kind: 'source' | 'stream' | 'raw' | 'bronze' | 'silver' | 'gold' | 'warehouse';
  label: string;
}

export interface FieldTransform {
  field: string;
  steps: string[];
}

export interface LineageGraph {
  target: string;
  path: LineageNode[];
  transforms: FieldTransform[];
}

export interface GoldRow {
  [key: string]: string | number | null;
}

export interface PipelineHealth {
  name: string;
  status: 'HEALTHY' | 'DEGRADED' | 'FAILED';
  note?: string;
}

export interface ObservabilitySnapshot {
  eventsToday: number;
  currentRate: number;
  pipelineLatencySec: number;
  dataQuality: number;
  quarantined: number;
  pipelines: PipelineHealth[];
}
