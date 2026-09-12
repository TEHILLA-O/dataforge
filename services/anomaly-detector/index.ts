export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MetricWindow {
  name: string;
  dataset: string;
  current: number;
  baseline: number;
  unit?: string;
}

export interface AnomalyAlert {
  dataset: string;
  metric: string;
  current: string;
  normal: string;
  severity: AnomalySeverity;
  window: string;
  reason: string;
}

export function detectAnomalies(metrics: MetricWindow[], windowLabel: string): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  for (const metric of metrics) {
    if (metric.baseline <= 0 && metric.current <= 0) continue;
    const ratio = metric.baseline === 0 ? Infinity : metric.current / metric.baseline;
    if (metric.name === 'failure_rate' && metric.current > 0.1) {
      alerts.push(alert(metric, 'HIGH', windowLabel, `${pct(metric.current)}`, '2–5%', 'Failure rate exceeds 10%'));
      continue;
    }
    if (metric.name === 'transaction_count' && ratio >= 5) {
      alerts.push(alert(metric, 'HIGH', windowLabel, String(Math.round(metric.current)), `${Math.round(metric.baseline)}`, 'Transaction count suddenly +400%'));
      continue;
    }
    if (metric.name === 'revenue' && ratio <= 0.2 && metric.baseline > 0) {
      alerts.push(alert(metric, 'CRITICAL', windowLabel, money(metric.current), money(metric.baseline), 'Revenue drops 80%'));
      continue;
    }
    if (metric.name === 'duplicate_rate' && metric.current > 0.05) {
      alerts.push(alert(metric, 'MEDIUM', windowLabel, pct(metric.current), '<1%', 'Duplicate-event rate spikes'));
      continue;
    }
    if (metric.name === 'pipeline_latency_sec' && metric.current > 60) {
      alerts.push(alert(metric, 'HIGH', windowLabel, `${metric.current.toFixed(1)}s`, '<5s', 'Pipeline latency exceeds 60 seconds'));
      continue;
    }
    if (metric.name === 'unusual_country' && metric.current > 0) {
      alerts.push(alert(metric, 'MEDIUM', windowLabel, String(metric.current), '0', 'Unusual country appears'));
    }
  }
  return alerts;
}

function alert(
  metric: MetricWindow,
  severity: AnomalySeverity,
  window: string,
  current: string,
  normal: string,
  reason: string,
): AnomalyAlert {
  return {
    dataset: metric.dataset,
    metric: metric.name,
    current,
    normal,
    severity,
    window,
    reason,
  };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number): string {
  return `£${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
