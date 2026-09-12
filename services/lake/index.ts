import * as path from 'path';
import { GOLD_DATASETS } from '../../infrastructure/lib/config';
import { enrich, EnrichedEvent } from '../enrichment';
import { evaluateQuality, routeRecord } from '../quality-engine';
import { applyPii } from '../pii';
import { appendJsonl, ensureDir, lakeDir, readJsonl, walkFiles, writeJson } from '../shared/paths';
import { FinancialEvent, GoldRow, QualityReport } from '../shared/types';

export interface LakeWriteResult {
  raw: number;
  bronze: number;
  silver: number;
  gold: number;
  quarantined: number;
  quality: QualityReport;
}

export function lakeRoot(): string {
  return lakeDir();
}

export function writeEvents(dataset: string, events: FinancialEvent[], at = new Date()): LakeWriteResult {
  const root = lakeDir();
  const prefix = partition(at);
  const rawPath = path.join(root, 'raw', dataset, prefix, 'events.jsonl');
  appendJsonl(rawPath, events);

  const bronze: EnrichedEvent[] = [];
  const quarantine: FinancialEvent[] = [];
  for (const event of events) {
    if (routeRecord(event) === 'quarantine') {
      quarantine.push(event);
    } else {
      bronze.push(enrich(event, at));
    }
  }

  appendJsonl(path.join(root, 'bronze', dataset, prefix, 'events.jsonl'), bronze);
  appendJsonl(path.join(root, 'quarantine', dataset, prefix, 'events.jsonl'), quarantine);

  const silver = dedupe(bronze).map((row) => applyPii(row, 'analyst')) as EnrichedEvent[];
  appendJsonl(path.join(root, 'silver', dataset, prefix, 'events.jsonl'), silver);

  const gold = materialiseGold(silver);
  for (const [name, rows] of Object.entries(gold)) {
    appendJsonl(path.join(root, 'gold', name, prefix, 'events.jsonl'), rows);
  }

  const quality = evaluateQuality(dataset, events);
  writeJson(path.join(root, '..', 'quality', `${dataset}.json`), quality);

  return {
    raw: events.length,
    bronze: bronze.length,
    silver: silver.length,
    gold: Object.values(gold).reduce((sum, rows) => sum + rows.length, 0),
    quarantined: quarantine.length,
    quality,
  };
}

export function readLayer(layer: string, dataset?: string): FinancialEvent[] {
  const dir = dataset ? path.join(lakeDir(), layer, dataset) : path.join(lakeDir(), layer);
  return walkFiles(dir).flatMap((file) => readJsonl<FinancialEvent>(file));
}

export function readGold(dataset: string): GoldRow[] {
  return walkFiles(path.join(lakeDir(), 'gold', dataset)).flatMap((file) => readJsonl<GoldRow>(file));
}

export function datasetInventory(): Array<{ layer: string; dataset: string; records: number }> {
  const root = lakeDir();
  ensureDir(root);
  const rows: Array<{ layer: string; dataset: string; records: number }> = [];
  for (const layer of ['raw', 'bronze', 'silver', 'gold', 'quarantine']) {
    const layerDir = path.join(root, layer);
    const names = listImmediateDirs(layerDir);
    for (const dataset of names) {
      rows.push({ layer, dataset, records: readLayer(layer, dataset).length });
    }
  }
  return rows;
}

function materialiseGold(silver: EnrichedEvent[]): Record<string, GoldRow[]> {
  const byCountry = new Map<string, { transactions: number; volume: number }>();
  const byMerchant = new Map<string, { transactions: number; volume: number }>();
  const byCustomer = new Map<string, { transactions: number; volume: number }>();
  let revenue = 0;
  let fraud = 0;
  let failures = 0;

  for (const row of silver) {
    const amount = row.amount_gbp ?? (typeof row.amount === 'number' ? row.amount : 0);
    revenue += amount;
    if (row.is_fraud) fraud += 1;
    if (row.level === 'ERROR') failures += 1;
    const country = row.country || 'UN';
    const countryRow = byCountry.get(country) || { transactions: 0, volume: 0 };
    countryRow.transactions += 1;
    countryRow.volume += amount;
    byCountry.set(country, countryRow);

    const merchant = row.merchant_category || 'unknown';
    const merchantRow = byMerchant.get(merchant) || { transactions: 0, volume: 0 };
    merchantRow.transactions += 1;
    merchantRow.volume += amount;
    byMerchant.set(merchant, merchantRow);

    const customer = row.customer_id || 'unknown';
    const customerRow = byCustomer.get(customer) || { transactions: 0, volume: 0 };
    customerRow.transactions += 1;
    customerRow.volume += amount;
    byCustomer.set(customer, customerRow);
  }

  const date = silver[0]?.event_date || new Date().toISOString().slice(0, 10);
  return {
    daily_revenue: [{ date, revenue: Number(revenue.toFixed(2)), transactions: silver.length, fraud }],
    customer_activity: [...byCustomer.entries()].map(([customer_id, v]) => ({
      customer_id,
      transactions: v.transactions,
      volume: Number(v.volume.toFixed(2)),
    })),
    country_performance: [...byCountry.entries()].map(([country, v]) => ({
      country,
      transactions: v.transactions,
      volume: Number(v.volume.toFixed(2)),
    })),
    fraud_summary: [{ date, fraud_events: fraud, rate: silver.length ? Number((fraud / silver.length).toFixed(4)) : 0 }],
    merchant_statistics: [...byMerchant.entries()].map(([merchant_category, v]) => ({
      merchant_category,
      transactions: v.transactions,
      volume: Number(v.volume.toFixed(2)),
    })),
    system_performance: [
      {
        date,
        events: silver.length,
        failures,
        failure_rate: silver.length ? Number((failures / silver.length).toFixed(4)) : 0,
      },
    ],
  };
}

function dedupe(rows: EnrichedEvent[]): EnrichedEvent[] {
  const seen = new Set<string>();
  const out: EnrichedEvent[] = [];
  for (const row of rows) {
    if (seen.has(row.event_id)) continue;
    seen.add(row.event_id);
    out.push(row);
  }
  return out;
}

function partition(at: Date): string {
  const year = at.getUTCFullYear();
  const month = String(at.getUTCMonth() + 1).padStart(2, '0');
  const day = String(at.getUTCDate()).padStart(2, '0');
  const hour = String(at.getUTCHours()).padStart(2, '0');
  return path.join(`year=${year}`, `month=${month}`, `day=${day}`, `hour=${hour}`);
}

function listImmediateDirs(dir: string): string[] {
  const fs = require('fs') as typeof import('fs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
}

export const GOLD_NAMES = GOLD_DATASETS;
