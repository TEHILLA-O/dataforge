import { Command } from 'commander';
import { datasetInventory } from '../../../../services/lake';
import { banner, formatNumber } from '../../../../services/shared/format';

export function datasetsCommand(): Command {
  return new Command('datasets').description('Medallion datasets in the local or last-synced lake').action(() => {
    const rows = datasetInventory();
    banner('DATAFORGE DATASETS');
    if (rows.length === 0) {
      console.log('Lake is empty. Run: dataforge generate --scenario payments --rate 80 --duration 5s');
      console.log('');
      return;
    }
    console.log(`${'Layer'.padEnd(14)}${'Dataset'.padEnd(24)}Records`);
    for (const row of rows) {
      console.log(`${row.layer.padEnd(14)}${row.dataset.padEnd(24)}${formatNumber(row.records)}`);
    }
    console.log('');
  });
}
