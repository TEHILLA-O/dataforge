import { Command } from 'commander';
import { catalogDatabase } from '../../../../infrastructure/lib/config';
import { runLocalQuery } from '../../../../services/query-engine';
import { banner, formatValue } from '../../../../services/shared/format';
import { CliContext, parameter, runAthena } from '../aws';

export function queryCommand(): Command {
  return new Command('query')
    .description('Run SQL against gold datasets (local engine or Athena)')
    .argument('<sql>', 'SELECT country, SUM(volume) FROM gold_country_performance GROUP BY country')
    .option('--athena', 'force Athena (requires a deployed Analytics stack)')
    .action(async function (this: Command, sql: string) {
      const ctx = this.optsWithGlobals() as CliContext;
      const opts = this.opts() as { athena?: boolean };
      if (opts.athena) {
        const resultsBucket = await parameter(ctx, 'lake-bucket');
        if (!resultsBucket) throw new Error('Deploy the Analytics stack before using --athena.');
        const rows = await runAthena(
          ctx,
          sql,
          catalogDatabase(ctx.env === 'prod' ? 'prod' : ctx.env === 'stage' ? 'stage' : 'dev', 'gold'),
          `s3://${resultsBucket}/athena-results/`,
        );
        banner('ATHENA');
        for (const row of rows) console.log(row.join('\t'));
        console.log('');
        return;
      }

      const result = runLocalQuery(sql);
      banner('QUERY');
      printRow('Source', result.source);
      console.log('');
      if (result.rows.length === 0) {
        console.log('0 rows. Generate data first: dataforge generate --rate 40 --duration 4s');
        console.log('');
        return;
      }
      const widths = result.columns.map((col) =>
        Math.max(col.length, ...result.rows.map((row) => String(formatValue(row[col])).length)),
      );
      console.log(result.columns.map((col, i) => col.padEnd(widths[i] + 2)).join(''));
      for (const row of result.rows) {
        console.log(result.columns.map((col, i) => String(formatValue(row[col])).padEnd(widths[i] + 2)).join(''));
      }
      console.log('');
      console.log(`${result.rows.length} row(s)`);
      console.log('');
    });
}

function printRow(label: string, value: string): void {
  console.log(`${label.padEnd(12)}${value}`);
}
