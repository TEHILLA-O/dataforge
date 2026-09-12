import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { planBackfill, runBackfill } from '../services/backfill';

describe('backfill engine', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dataforge-'));

  beforeAll(() => {
    process.env.DATAFORGE_HOME = home;
    process.env.DATAFORGE_LAKE_DIR = path.join(home, 'lake');
  });

  it('plans inclusive calendar days', () => {
    expect(planBackfill({ dataset: 'transactions', from: '2026-09-01', to: '2026-09-07' })).toHaveLength(7);
  });

  it('dry-run does not write silver records', () => {
    const result = runBackfill({
      dataset: 'transactions',
      from: '2026-09-01',
      to: '2026-09-02',
      dryRun: true,
    });
    expect(result.status).toBe('running');
    expect(result.records).toBe(0);
  });

  it('resume skips already processed days', () => {
    runBackfill({ dataset: 'transactions', from: '2026-09-01', to: '2026-09-01' });
    const again = runBackfill({
      dataset: 'transactions',
      from: '2026-09-01',
      to: '2026-09-02',
      resume: true,
    });
    expect(again.processedDays).toContain('2026-09-02');
    expect(again.skipped).toBeGreaterThan(0);
  });
});
