import { EventGenerator } from '../services/event-generator';

describe('event generator', () => {
  it('emits a stable stream for a fixed seed', () => {
    const a = new EventGenerator({ scenario: 'payments', seed: 7 }).nextBatch(20);
    const b = new EventGenerator({ scenario: 'payments', seed: 7 }).nextBatch(20);
    expect(a.map((e) => e.event_id)).toEqual(b.map((e) => e.event_id));
    expect(a[0].currency).toBeDefined();
    expect(a[0].schema_version).toBe(3);
  });

  it('injects the defect classes the pipeline has to survive', () => {
    const events = new EventGenerator({ scenario: 'ecommerce', seed: 99 }).nextBatch(4000);
    const defects = new Set(events.map((e) => e._defect).filter(Boolean));
    expect(defects.has('missing_customer_id')).toBe(true);
    expect(defects.has('invalid_currency')).toBe(true);
    expect(defects.has('negative_amount')).toBe(true);
    expect(defects.has('duplicate')).toBe(true);
    expect(defects.has('late_event')).toBe(true);
    expect(defects.has('fraud')).toBe(true);
  });

  it('partitions iot by device and payments by customer', () => {
    const iot = new EventGenerator({ scenario: 'iot', seed: 1 }).next();
    const pay = new EventGenerator({ scenario: 'payments', seed: 1 }).next();
    expect(new EventGenerator({ scenario: 'iot', seed: 1 }).partitionKey(iot)).toMatch(/^DEV-|mobile|web|pos|atm|iot/);
    expect(new EventGenerator({ scenario: 'payments', seed: 1 }).partitionKey(pay)).toMatch(/^CUS-|evt-/);
  });
});
