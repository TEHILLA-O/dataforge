import { CURRENCIES } from '../shared/types';
import { FinancialEvent, QualityIssue, QualityReport } from '../shared/types';

const REQUIRED = ['event_id', 'event_type', 'timestamp'] as const;
const FINANCIAL_REQUIRED = ['customer_id', 'amount', 'currency'] as const;

export function evaluateQuality(dataset: string, records: FinancialEvent[]): QualityReport {
  const issues: Record<string, QualityIssue> = {};
  const seen = new Set<string>();
  let complete = 0;
  let valid = 0;
  let unique = 0;
  let quarantined = 0;

  for (const record of records) {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const field of REQUIRED) {
      if (!hasValue(record[field])) missing.push(field);
    }
    if (dataset !== 'logs' && dataset !== 'iot') {
      for (const field of FINANCIAL_REQUIRED) {
        if (!hasValue(record[field as keyof FinancialEvent])) missing.push(field);
      }
    }

    if (record.currency && !CURRENCIES.includes(record.currency as (typeof CURRENCIES)[number]) && record.currency !== undefined) {
      invalid.push('currency');
      bump(issues, 'INVALID currency', 'currency');
    }
    if (typeof record.amount === 'number' && record.amount < 0) {
      invalid.push('amount');
      bump(issues, 'NEGATIVE amount', 'amount');
    }
    if (typeof record.amount === 'string') {
      invalid.push('amount');
      bump(issues, 'INVALID amount', 'amount');
    }
    if (record.timestamp && Date.parse(record.timestamp) > Date.now() + 60_000) {
      invalid.push('timestamp');
      bump(issues, 'FUTURE timestamps', 'timestamp');
    }
    if (!record.event_type) {
      invalid.push('event_type');
      bump(issues, 'INVALID schema', 'event_type');
    }
    for (const field of missing) {
      bump(issues, `MISSING ${field}`, field);
    }

    const id = record.event_id || '';
    const isDuplicate = id !== '' && seen.has(id);
    if (isDuplicate) bump(issues, 'DUPLICATE event_id', 'event_id');
    if (id) seen.add(id);

    const isComplete = missing.length === 0;
    const isValid = invalid.length === 0 && typeof record.amount !== 'string';
    if (isComplete) complete += 1;
    if (isValid) valid += 1;
    if (!isDuplicate && id) unique += 1;
    if (!isComplete || !isValid || isDuplicate) quarantined += 1;
  }

  const total = Math.max(records.length, 1);
  const completeness = (complete / total) * 100;
  const validity = (valid / total) * 100;
  const uniqueness = records.length === 0 ? 100 : (unique / total) * 100;
  const score = Number((completeness * 0.4 + validity * 0.4 + uniqueness * 0.2).toFixed(1));

  return {
    dataset,
    records: records.length,
    completeness: Number(completeness.toFixed(2)),
    validity: Number(validity.toFixed(2)),
    uniqueness: Number(uniqueness.toFixed(2)),
    issues: Object.values(issues).sort((a, b) => b.count - a.count),
    quarantined,
    score,
  };
}

export function routeRecord(record: FinancialEvent): 'bronze' | 'quarantine' {
  const report = evaluateQuality('transactions', [record]);
  return report.quarantined > 0 ? 'quarantine' : 'bronze';
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function bump(issues: Record<string, QualityIssue>, code: string, field: string): void {
  if (!issues[code]) issues[code] = { code, field, count: 0 };
  issues[code].count += 1;
}
