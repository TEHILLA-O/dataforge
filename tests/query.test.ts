import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeEvents } from '../services/lake';
import { runLocalQuery } from '../services/query-engine';
import { EventGenerator } from '../services/event-generator';

describe('local query engine', () => {
  beforeAll(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dataforge-q-'));
    process.env.DATAFORGE_HOME = home;
    process.env.DATAFORGE_LAKE_DIR = path.join(home, 'lake');
    const events = new EventGenerator({ scenario: 'payments', seed: 3, schemaVersion: 3 }).nextBatch(80);
    writeEvents('transactions', events, new Date('2026-09-12T12:00:00Z'));
  });

  it('aggregates gold country volume', () => {
    const result = runLocalQuery(
      'SELECT country, SUM(volume) AS volume FROM gold_country_performance GROUP BY country ORDER BY volume DESC',
    );
    expect(result.rows.length).toBeGreaterThan(1);
    expect(result.columns).toEqual(expect.arrayContaining(['country', 'volume']));
  });
});
