import { LineageGraph, LineageNode } from '../shared/types';

const CATALOG: Record<string, LineageGraph> = {
  'gold.daily_revenue': {
    target: 'gold.daily_revenue',
    path: [
      { id: 'generator', kind: 'source', label: 'transaction-generator' },
      { id: 'kinesis', kind: 'stream', label: 'Kinesis Data Stream' },
      { id: 'raw', kind: 'raw', label: 'raw/kinesis/transactions' },
      { id: 'bronze', kind: 'bronze', label: 'bronze.transactions' },
      { id: 'silver', kind: 'silver', label: 'silver.transactions' },
      { id: 'gold', kind: 'gold', label: 'gold.daily_revenue' },
    ],
    transforms: [
      { field: 'amount', steps: ['RAW.amount', 'cast decimal', 'BRONZE.amount', 'remove invalid values', 'SILVER.amount', 'SUM', 'GOLD.daily_revenue'] },
      { field: 'country', steps: ['RAW.country', 'ISO-3166 validate', 'enrich country_name', 'SILVER.country', 'GROUP BY', 'GOLD.country_performance'] },
    ],
  },
  'gold.customer_activity': {
    target: 'gold.customer_activity',
    path: [
      { id: 'generator', kind: 'source', label: 'transaction-generator' },
      { id: 'kinesis', kind: 'stream', label: 'Kinesis Data Stream' },
      { id: 'raw', kind: 'raw', label: 'raw/kinesis/transactions' },
      { id: 'bronze', kind: 'bronze', label: 'bronze.transactions' },
      { id: 'silver', kind: 'silver', label: 'silver.transactions' },
      { id: 'gold', kind: 'gold', label: 'gold.customer_activity' },
    ],
    transforms: [
      { field: 'customer_id', steps: ['RAW.customer_id', 'drop missing', 'SILVER.customer_id', 'COUNT DISTINCT', 'GOLD.active_customers'] },
    ],
  },
  'gold.fraud_summary': {
    target: 'gold.fraud_summary',
    path: [
      { id: 'generator', kind: 'source', label: 'transaction-generator' },
      { id: 'kinesis', kind: 'stream', label: 'Kinesis Data Stream' },
      { id: 'raw', kind: 'raw', label: 'raw/kinesis/transactions' },
      { id: 'bronze', kind: 'bronze', label: 'bronze.transactions' },
      { id: 'silver', kind: 'silver', label: 'silver.transactions' },
      { id: 'gold', kind: 'gold', label: 'gold.fraud_summary' },
    ],
    transforms: [
      { field: 'risk_score', steps: ['RAW.risk_score', 'default 0.05', 'SILVER.risk_score', 'filter >= 0.8', 'GOLD.fraud_count'] },
    ],
  },
  'gold.country_performance': {
    target: 'gold.country_performance',
    path: [
      { id: 'generator', kind: 'source', label: 'transaction-generator' },
      { id: 'kinesis', kind: 'stream', label: 'Kinesis Data Stream' },
      { id: 'raw', kind: 'raw', label: 'raw/kinesis/transactions' },
      { id: 'bronze', kind: 'bronze', label: 'bronze.transactions' },
      { id: 'silver', kind: 'silver', label: 'silver.transactions' },
      { id: 'gold', kind: 'gold', label: 'gold.country_performance' },
    ],
    transforms: [{ field: 'amount', steps: ['SILVER.amount', 'SUM by country', 'GOLD.volume'] }],
  },
  'gold.merchant_statistics': {
    target: 'gold.merchant_statistics',
    path: [
      { id: 'generator', kind: 'source', label: 'transaction-generator' },
      { id: 'kinesis', kind: 'stream', label: 'Kinesis Data Stream' },
      { id: 'raw', kind: 'raw', label: 'raw/kinesis/transactions' },
      { id: 'bronze', kind: 'bronze', label: 'bronze.transactions' },
      { id: 'silver', kind: 'silver', label: 'silver.transactions' },
      { id: 'gold', kind: 'gold', label: 'gold.merchant_statistics' },
    ],
    transforms: [{ field: 'merchant_category', steps: ['RAW.merchant_category', 'schema v2+', 'GROUP BY', 'GOLD.merchant_statistics'] }],
  },
  'gold.system_performance': {
    target: 'gold.system_performance',
    path: [
      { id: 'generator', kind: 'source', label: 'log-generator' },
      { id: 'kinesis', kind: 'stream', label: 'Kinesis Data Stream' },
      { id: 'raw', kind: 'raw', label: 'raw/kinesis/logs' },
      { id: 'bronze', kind: 'bronze', label: 'bronze.logs' },
      { id: 'silver', kind: 'silver', label: 'silver.logs' },
      { id: 'gold', kind: 'gold', label: 'gold.system_performance' },
    ],
    transforms: [{ field: 'level', steps: ['RAW.level', 'count ERROR', 'GOLD.failure_rate'] }],
  },
  'redshift.fact_transaction': {
    target: 'redshift.fact_transaction',
    path: [
      { id: 'gold', kind: 'gold', label: 'gold.daily_revenue' },
      { id: 'warehouse', kind: 'warehouse', label: 'redshift.fact_transaction' },
    ],
    transforms: [{ field: 'amount', steps: ['GOLD.amount', 'COPY', 'FACT_TRANSACTION.amount'] }],
  },
};

export function lineageOf(target: string): LineageGraph {
  const key = target.trim().toLowerCase();
  const found = CATALOG[key] || Object.entries(CATALOG).find(([id]) => id.endsWith(key))?.[1];
  if (!found) {
    throw new Error(`No lineage for "${target}". Try gold.daily_revenue or gold.fraud_summary.`);
  }
  return found;
}

export function listLineageTargets(): string[] {
  return Object.keys(CATALOG);
}

export function renderLineage(graph: LineageGraph): string {
  const lines = graph.path
    .slice()
    .reverse()
    .map((node: LineageNode, index, all) => {
      const pad = '        ';
      const arrow = index === all.length - 1 ? '' : `${pad}↑`;
      return index === 0 ? node.label : `${node.label}\n${arrow}`;
    });
  // reverse() already put gold first; join with arrows between
  const body: string[] = [];
  const ordered = graph.path.slice().reverse();
  ordered.forEach((node, i) => {
    body.push(node.label);
    if (i < ordered.length - 1) body.push('        ↑');
  });
  return body.join('\n');
}
