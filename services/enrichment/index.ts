import { FinancialEvent } from '../shared/types';

const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  IE: 'Ireland',
  FR: 'France',
  DE: 'Germany',
  US: 'United States',
  NL: 'Netherlands',
  ES: 'Spain',
  IT: 'Italy',
  SE: 'Sweden',
  NO: 'Norway',
};

export interface EnrichedEvent extends FinancialEvent {
  country_name?: string;
  amount_gbp?: number;
  event_date?: string;
  event_hour?: number;
  is_fraud?: boolean;
  ingested_at: string;
}

const FX: Record<string, number> = {
  GBP: 1,
  EUR: 0.85,
  USD: 0.78,
  JPY: 0.0052,
};

export function enrich(event: FinancialEvent, ingestedAt = new Date()): EnrichedEvent {
  const ts = Date.parse(event.timestamp) || ingestedAt.getTime();
  const date = new Date(ts);
  const amount = typeof event.amount === 'number' ? event.amount : undefined;
  const fx = event.currency ? FX[event.currency] : undefined;
  return {
    ...event,
    country_name: event.country ? COUNTRY_NAMES[event.country] || 'Unknown' : undefined,
    amount_gbp: amount !== undefined && fx ? Number((amount * fx).toFixed(2)) : undefined,
    event_date: date.toISOString().slice(0, 10),
    event_hour: date.getUTCHours(),
    is_fraud: (event.risk_score ?? 0) >= 0.8 || event.country === 'XX',
    ingested_at: ingestedAt.toISOString(),
    risk_score: event.risk_score ?? 0.05,
  };
}
