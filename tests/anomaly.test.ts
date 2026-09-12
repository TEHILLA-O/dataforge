import { detectAnomalies } from '../services/anomaly-detector';

describe('anomaly detector', () => {
  it('raises on failure rate, revenue collapse and lag', () => {
    const alerts = detectAnomalies(
      [
        { name: 'failure_rate', dataset: 'payments', current: 0.174, baseline: 0.03 },
        { name: 'revenue', dataset: 'payments', current: 200, baseline: 2000 },
        { name: 'pipeline_latency_sec', dataset: 'payments', current: 72, baseline: 2 },
      ],
      '22:10–22:15',
    );
    expect(alerts.map((a) => a.metric)).toEqual(
      expect.arrayContaining(['failure_rate', 'revenue', 'pipeline_latency_sec']),
    );
    expect(alerts.find((a) => a.metric === 'failure_rate')?.severity).toBe('HIGH');
  });
});
