import { evaluateQuality, routeRecord } from '../services/quality-engine';
import { FinancialEvent } from '../services/shared/types';

const good: FinancialEvent = {
  event_id: 'evt-1',
  customer_id: 'CUS-1',
  event_type: 'payment',
  amount: 10,
  currency: 'GBP',
  timestamp: '2026-09-12T10:00:00Z',
  schema_version: 1,
};

describe('quality engine', () => {
  it('scores a clean batch near 100', () => {
    const report = evaluateQuality('transactions', [good, { ...good, event_id: 'evt-2' }]);
    expect(report.score).toBeGreaterThan(99);
    expect(report.quarantined).toBe(0);
  });

  it('quarantines missing, invalid, negative and duplicate rows', () => {
    const batch: FinancialEvent[] = [
      good,
      { ...good, event_id: 'evt-1' },
      { ...good, event_id: 'evt-3', customer_id: undefined },
      { ...good, event_id: 'evt-4', currency: 'XXX' },
      { ...good, event_id: 'evt-5', amount: -4 },
    ];
    const report = evaluateQuality('transactions', batch);
    expect(report.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(['DUPLICATE event_id', 'MISSING customer_id', 'INVALID currency', 'NEGATIVE amount']),
    );
    expect(routeRecord(batch[2])).toBe('quarantine');
    expect(routeRecord(good)).toBe('bronze');
  });
});
