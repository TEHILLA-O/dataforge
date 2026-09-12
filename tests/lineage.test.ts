import { lineageOf, renderLineage } from '../services/lineage';

describe('lineage', () => {
  it('walks gold.daily_revenue back to the generator', () => {
    const graph = lineageOf('gold.daily_revenue');
    const labels = graph.path.map((n) => n.label);
    expect(labels[0]).toBe('transaction-generator');
    expect(labels.at(-1)).toBe('gold.daily_revenue');
    expect(renderLineage(graph)).toContain('Kinesis Data Stream');
    expect(graph.transforms[0].steps).toContain('GOLD.daily_revenue');
  });
});
