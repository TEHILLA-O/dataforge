import { ObservabilitySnapshot, StreamSnapshot } from './types';
import { dataDir, readJson, writeJson } from './paths';
import * as path from 'path';

export interface PlatformState {
  region: string;
  environment: string;
  lastGenerate?: {
    scenario: string;
    rate: number;
    durationMs: number;
    events: number;
    failed: number;
    at: string;
    sink: string;
  };
  stream: StreamSnapshot;
  observability: ObservabilitySnapshot;
  qualityScore?: number;
  alerts: { critical: number; warning: number };
}

export function defaultState(): PlatformState {
  return {
    region: process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'eu-west-2',
    environment: process.env.DATAFORGE_ENV || 'dev',
    stream: {
      stream: 'transactions-prod',
      status: 'IDLE',
      shards: 4,
      incomingRecordsPerSec: 0,
      incomingBytesPerSec: 0,
      iteratorAgeMs: 0,
      failedRecords: 0,
      lastMinuteEvents: 0,
    },
    observability: {
      eventsToday: 0,
      currentRate: 0,
      pipelineLatencySec: 1.2,
      dataQuality: 100,
      quarantined: 0,
      pipelines: [
        { name: 'Transactions', status: 'HEALTHY' },
        { name: 'Customer Events', status: 'HEALTHY' },
        { name: 'Logs', status: 'HEALTHY' },
        { name: 'IoT', status: 'HEALTHY' },
      ],
    },
    alerts: { critical: 0, warning: 0 },
  };
}

export function loadState(): PlatformState {
  return { ...defaultState(), ...readJson<Partial<PlatformState>>(path.join(dataDir(), 'state.json'), {}) };
}

export function saveState(state: PlatformState): void {
  writeJson(path.join(dataDir(), 'state.json'), state);
}
