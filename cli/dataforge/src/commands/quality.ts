import { Command } from 'commander';
import { evaluateQuality } from '../../../../services/quality-engine';
import { readLayer } from '../../../../services/lake';
import { banner, formatNumber, formatPercent, printRow } from '../../../../services/shared/format';

export function qualityCommand(): Command {
  return new Command('quality')
    .description('Data quality report for a dataset')
    .argument('[dataset]', 'transactions', 'transactions')
    .action((dataset: string) => {
      const records = readLayer('raw', dataset);
      if (records.length === 0) {
        throw new Error(`No raw records for ${dataset}. Run dataforge generate first.`);
      }
      const report = evaluateQuality(dataset, records);
      banner('DATA QUALITY REPORT');
      console.log('');
      console.log('Dataset');
      console.log(report.dataset);
      console.log('');
      printRow('Records', formatNumber(report.records));
      console.log('');
      printRow('Completeness', formatPercent(report.completeness));
      printRow('Validity', formatPercent(report.validity));
      printRow('Uniqueness', formatPercent(report.uniqueness));
      console.log('');
      console.log('Issues');
      console.log('');
      if (report.issues.length === 0) {
        console.log('None');
      } else {
        for (const issue of report.issues) {
          printRow(issue.code, formatNumber(issue.count), 26);
        }
      }
      console.log('');
      console.log('QUALITY SCORE');
      console.log('');
      console.log(`${report.score.toFixed(1)} / 100`);
      console.log('');
      printRow('Quarantined', formatNumber(report.quarantined));
      console.log('');
    });
}
