import { diffSchemas, getSchema } from '../services/schema-registry';

describe('schema evolution', () => {
  it('treats optional merchant_category as backward compatible', () => {
    const diff = diffSchemas('transaction-v1', 'transaction-v2');
    expect(diff.added.map((f) => f.name)).toEqual(expect.arrayContaining(['merchant_category']));
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.compatibility).toBe('BACKWARD COMPATIBLE');
  });

  it('marks a type change as breaking', () => {
    const v1 = getSchema('transaction-v1');
    expect(v1.fields.find((f) => f.name === 'amount')?.type).toBe('decimal');
    const breaking = diffSchemas('transaction-v1', 'transaction-v1');
    expect(breaking.compatibility).toBe('FULLY COMPATIBLE');
  });
});
