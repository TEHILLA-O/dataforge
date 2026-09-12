import * as path from 'path';
import { writeEvents } from '../lake';
import { EventGenerator } from '../event-generator';
import { dataDir, readJson, writeJson } from '../shared/paths';
import { FinancialEvent, Scenario } from '../shared/types';
import { readLayer } from '../lake';

export interface BackfillOptions {
  dataset: string;
  from: string;
  to: string;
  scenario?: Scenario;
  dryRun?: boolean;
  resume?: boolean;
}

export interface BackfillCheckpoint {
  dataset: string;
  from: string;
  to: string;
  nextDay: string;
  processedDays: string[];
  records: number;
  skipped: number;
  status: 'running' | 'completed';
}

export function checkpointPath(dataset: string): string {
  return path.join(dataDir(), 'checkpoints', `${dataset}.json`);
}

export function planBackfill(options: BackfillOptions): string[] {
  const start = parseDay(options.from);
  const end = parseDay(options.to);
  if (end < start) throw new Error('--to must be on or after --from');
  const days: string[] = [];
  for (let cursor = start; cursor <= end; cursor += 86_400_000) {
    days.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return days;
}

export function runBackfill(options: BackfillOptions): BackfillCheckpoint {
  const days = planBackfill(options);
  const existing = options.resume ? readJson<BackfillCheckpoint | null>(checkpointPath(options.dataset), null) : null;
  const already = new Set(existing?.processedDays || []);
  const seen = new Set(readLayer('silver', options.dataset).map((e) => e.event_id));

  const checkpoint: BackfillCheckpoint = existing || {
    dataset: options.dataset,
    from: options.from,
    to: options.to,
    nextDay: days[0],
    processedDays: [],
    records: 0,
    skipped: 0,
    status: 'running',
  };

  if (options.dryRun) {
    checkpoint.nextDay = days.find((d) => !already.has(d)) || days[days.length - 1];
    checkpoint.status = 'running';
    return checkpoint;
  }

  const generator = new EventGenerator({
    scenario: options.scenario || 'ecommerce',
    seed: 20260901,
    schemaVersion: 3,
  });

  for (const day of days) {
    if (already.has(day)) {
      checkpoint.skipped += 1;
      continue;
    }
    const at = new Date(`${day}T12:00:00Z`);
    const batch = generator.nextBatch(120, at).filter((event) => {
      if (seen.has(event.event_id)) {
        checkpoint.skipped += 1;
        return false;
      }
      seen.add(event.event_id);
      return true;
    });
    writeEvents(options.dataset, batch as FinancialEvent[], at);
    checkpoint.records += batch.length;
    checkpoint.processedDays.push(day);
    checkpoint.nextDay = day;
    writeJson(checkpointPath(options.dataset), checkpoint);
  }

  checkpoint.status = 'completed';
  writeJson(checkpointPath(options.dataset), checkpoint);
  return checkpoint;
}

function parseDay(value: string): number {
  const match = /^(\d{4}-\d{2}-\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  return Date.parse(`${value}T00:00:00Z`);
}
