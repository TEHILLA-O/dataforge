import { Command } from 'commander';
import { banner, printRow } from '../../../../services/shared/format';
import { resolveEnvironment } from '../../../../infrastructure/lib/config';
import { CliContext, monthToDateCost } from '../aws';

export function costsCommand(): Command {
  return new Command('costs').description('Month-to-date spend for Project=DataForge').action(async function (this: Command) {
    const ctx = this.optsWithGlobals() as CliContext;
    const profile = resolveEnvironment(ctx.env);
    banner('DATAFORGE COSTS');
    printRow('Profile', profile.name);
    printRow('Budget', `£${profile.cost.monthlyBudget} / month`);
    printRow('Redshift', profile.analytics.enableRedshift ? `${profile.analytics.redshiftBaseCapacityRpu} RPU` : 'off');
    printRow('Glue streaming', profile.streaming.enableGlueStreaming ? 'defined' : 'off in this profile');
    try {
      printRow('Month to date', await monthToDateCost(ctx));
    } catch {
      printRow('Month to date', 'n/a (no Cost Explorer access — expected in local demo)');
    }
    console.log('');
    console.log('Destroy the lab when the interview ends:  dataforge destroy dev');
    console.log('');
  });
}
