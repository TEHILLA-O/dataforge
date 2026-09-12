import { applyPii, maskEmail } from '../services/pii';

describe('pii protection', () => {
  it('masks email for analysts and strips it for restricted personas', () => {
    expect(maskEmail('victrom@example.com')).toBe('v******@example.com');
    const event = {
      event_id: 'e',
      event_type: 'payment',
      timestamp: '2026-09-12T00:00:00Z',
      schema_version: 3,
      email: 'victrom@example.com',
      customer_name: 'Victor Roman',
    };
    expect(applyPii(event, 'analyst').email).toBe('v******@example.com');
    expect(applyPii(event, 'restricted').email).toBeUndefined();
    expect(applyPii(event, 'administrator').email).toBe('victrom@example.com');
  });
});
