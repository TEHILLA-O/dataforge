export function banner(title: string): void {
  console.log('');
  console.log(title);
  console.log('─'.repeat(Math.max(12, title.length)));
}

export function printRow(label: string, value: unknown, width = 22): void {
  console.log(`${label.padEnd(width)}${formatValue(value)}`);
}

export function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function parseDuration(input: string): number {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration "${input}". Use 30s, 10m or 1h.`);
  }
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    default:
      throw new Error(`Unsupported duration unit "${unit}"`);
  }
}

export function partitionPath(now = new Date()): { year: string; month: string; day: string; hour: string } {
  return {
    year: String(now.getUTCFullYear()),
    month: String(now.getUTCMonth() + 1).padStart(2, '0'),
    day: String(now.getUTCDate()).padStart(2, '0'),
    hour: String(now.getUTCHours()).padStart(2, '0'),
  };
}

export function s3PartitionPrefix(layer: string, dataset: string, at = new Date()): string {
  const p = partitionPath(at);
  return `${layer}/${dataset}/year=${p.year}/month=${p.month}/day=${p.day}/hour=${p.hour}`;
}

export function check(ok: boolean): string {
  return ok ? '✓' : '✗';
}
