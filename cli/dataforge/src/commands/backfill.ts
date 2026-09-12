import { Command } from 'commander';
import { planBackfill, runBackfill } from '../../../../services/backfill';
import { scenarioFromArgs } from '../../../../services/event-generator';
import { banner, formatNumber, printRow } from '../../../../services/shared/format';

export function backfillCommand(): Command {
  return new Command('backfill')
    .description('Reprocess a historical date range without duplicating silver records')
    .requiredOption('--dataset <name>', 'dataset to rebuild', 'transactions')
    .requiredOption('--from <date>', 'YYYY-MM-DD')
    .requiredOption('--to <date>', 'YYYY-MM-DD')
    .option('--scenario <name>', 'ecommerce | payments | banking | iot | logs | fraud', 'ecommerce')
    .option('--dry-run', 'print the plan only', false)
    .option('--resume', 'continue from the last checkpoint', false)
    .action(function (this: Command) {
      const opts = this.opts() as {
        dataset: string;
        from: string;
        to: string;
        scenario: string;
        dryRun?: boolean;
        resume?: boolean;
      };
      const days = planBackfill({ dataset: opts.dataset, from: opts.from, to: opts.to });
      banner('DATAFORGE BACKFILL');
      printRow('Dataset', opts.dataset);
      printRow('From', opts.from);
      printRow('To', opts.to);
      printRow('Days', days.length);
      printRow('Mode', opts.dryRun ? 'dry-run' : opts.resume ? 'resume' : 'run');
      console.log('');

      const result = runBackfill({
        dataset: opts.dataset,
        from: opts.from,
        to: opts.to,
        scenario: scenarioFromArgs(opts.scenario),
        dryRun: Boolean(opts.dryRun),
        resume: Boolean(opts.resume),
      });

      printRow('Status', result.status);
      printRow('Processed days', result.processedDays.length);
      printRow('Records', formatNumber(result.records));
      printRow('Skipped', formatNumber(result.skipped));
      printRow('Checkpoint', result.nextDay);
      console.log('');
    });
}
