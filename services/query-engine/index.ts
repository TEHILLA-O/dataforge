import { readGold, readLayer } from '../lake';
import { GoldRow } from '../shared/types';

export interface QueryResult {
  columns: string[];
  rows: GoldRow[];
  source: string;
}

const TABLE_ALIASES: Record<string, { layer: string; dataset: string }> = {
  gold_transactions: { layer: 'gold', dataset: 'country_performance' },
  gold_daily_revenue: { layer: 'gold', dataset: 'daily_revenue' },
  gold_country_performance: { layer: 'gold', dataset: 'country_performance' },
  gold_customer_activity: { layer: 'gold', dataset: 'customer_activity' },
  gold_fraud_summary: { layer: 'gold', dataset: 'fraud_summary' },
  gold_merchant_statistics: { layer: 'gold', dataset: 'merchant_statistics' },
  silver_transactions: { layer: 'silver', dataset: 'transactions' },
  bronze_transactions: { layer: 'bronze', dataset: 'transactions' },
};

export function runLocalQuery(sql: string): QueryResult {
  const parsed = parseSelect(sql);
  const table = TABLE_ALIASES[parsed.from] || guessTable(parsed.from);
  const sourceRows =
    table.layer === 'gold' ? readGold(table.dataset) : (readLayer(table.layer, table.dataset) as unknown as GoldRow[]);

  const filtered = parsed.where ? sourceRows.filter((row) => matchWhere(row, parsed.where!)) : sourceRows;
  const projected = parsed.groupBy.length > 0 ? aggregate(filtered, parsed) : project(filtered, parsed.select);
  const ordered = parsed.orderBy ? sortRows(projected, parsed.orderBy, parsed.orderDir) : projected;
  const limited = parsed.limit ? ordered.slice(0, parsed.limit) : ordered;
  const columns = limited[0] ? Object.keys(limited[0]) : parsed.select.map((s) => s.alias);
  return { columns, rows: limited, source: `${table.layer}.${table.dataset}` };
}

interface SelectField {
  expr: string;
  alias: string;
  agg?: 'sum' | 'count' | 'avg';
}

interface ParsedSelect {
  select: SelectField[];
  from: string;
  where?: { field: string; op: '=' | '!=' | '>' | '<' ; value: string };
  groupBy: string[];
  orderBy?: string;
  orderDir: 'asc' | 'desc';
  limit?: number;
}

function parseSelect(sql: string): ParsedSelect {
  const cleaned = sql.replace(/\s+/g, ' ').trim().replace(/;$/, '');
  const match = /^select (.+) from ([a-z0-9_.]+)(?: where ([a-z0-9_]+) *(=|!=|>|<) *('[^']+'|[0-9.]+))?(?: group by ([a-z0-9_]+(?:\s*,\s*[a-z0-9_]+)*))?(?: order by ([a-z0-9_]+)(?: (asc|desc))?)?(?: limit (\d+))?$/i.exec(
    cleaned,
  );
  if (!match) {
    throw new Error('Supported SQL: SELECT cols FROM table [WHERE field = value] [GROUP BY col] [ORDER BY col] [LIMIT n]');
  }
  const select = match[1].split(',').map((part) => parseField(part.trim()));
  return {
    select,
    from: match[2].toLowerCase().replace('.', '_'),
    where: match[3]
      ? { field: match[3], op: match[4] as '=' | '!=' | '>' | '<', value: stripQuotes(match[5]) }
      : undefined,
    groupBy: match[6] ? match[6].split(',').map((s) => s.trim()) : [],
    orderBy: match[7],
    orderDir: (match[8] || 'asc').toLowerCase() as 'asc' | 'desc',
    limit: match[9] ? Number(match[9]) : undefined,
  };
}

function parseField(part: string): SelectField {
  const aliased = /^(.+) as ([a-z0-9_]+)$/i.exec(part);
  const raw = aliased ? aliased[1].trim() : part;
  const alias = aliased ? aliased[2] : raw.replace(/[()]/g, '').replace(/\s+/g, '_');
  const agg = /^(sum|count|avg)\((.+)\)$/i.exec(raw);
  if (agg) return { expr: agg[2], alias, agg: agg[1].toLowerCase() as SelectField['agg'] };
  return { expr: raw, alias: alias === '*' ? '*' : alias };
}

function project(rows: GoldRow[], fields: SelectField[]): GoldRow[] {
  if (fields.length === 1 && fields[0].expr === '*') return rows;
  return rows.map((row) => {
    const out: GoldRow = {};
    for (const field of fields) {
      out[field.alias] = row[field.expr] ?? null;
    }
    return out;
  });
}

function aggregate(rows: GoldRow[], parsed: ParsedSelect): GoldRow[] {
  const groups = new Map<string, GoldRow[]>();
  for (const row of rows) {
    const key = parsed.groupBy.map((g) => String(row[g] ?? '')).join('|');
    const bucket = groups.get(key) || [];
    bucket.push(row);
    groups.set(key, bucket);
  }
  const out: GoldRow[] = [];
  for (const bucket of groups.values()) {
    const row: GoldRow = {};
    for (const field of parsed.select) {
      if (field.agg === 'count') {
        row[field.alias] = field.expr === '*' ? bucket.length : bucket.filter((r) => r[field.expr] != null).length;
      } else if (field.agg === 'sum') {
        row[field.alias] = Number(bucket.reduce((sum, r) => sum + Number(r[field.expr] || 0), 0).toFixed(2));
      } else if (field.agg === 'avg') {
        row[field.alias] = Number(
          (bucket.reduce((sum, r) => sum + Number(r[field.expr] || 0), 0) / Math.max(bucket.length, 1)).toFixed(2),
        );
      } else {
        row[field.alias] = bucket[0][field.expr] ?? bucket[0][field.alias] ?? null;
      }
    }
    out.push(row);
  }
  return out;
}

function sortRows(rows: GoldRow[], field: string, dir: 'asc' | 'desc'): GoldRow[] {
  return [...rows].sort((a, b) => {
    const av = a[field] ?? a[Object.keys(a).find((k) => k.toLowerCase() === field.toLowerCase()) || ''];
    const bv = b[field] ?? b[Object.keys(b).find((k) => k.toLowerCase() === field.toLowerCase()) || ''];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return dir === 'desc' ? -cmp : cmp;
  });
}

function matchWhere(row: GoldRow, where: NonNullable<ParsedSelect['where']>): boolean {
  const left = row[where.field];
  const right = Number.isNaN(Number(where.value)) ? where.value : Number(where.value);
  switch (where.op) {
    case '=':
      return left == right;
    case '!=':
      return left != right;
    case '>':
      return Number(left) > Number(right);
    case '<':
      return Number(left) < Number(right);
    default:
      return true;
  }
}

function stripQuotes(value: string): string {
  return value.replace(/^'|'$/g, '');
}

function guessTable(from: string): { layer: string; dataset: string } {
  if (from.startsWith('gold_')) return { layer: 'gold', dataset: from.replace(/^gold_/, '') };
  if (from.startsWith('silver_')) return { layer: 'silver', dataset: from.replace(/^silver_/, '') };
  return { layer: 'gold', dataset: from };
}
