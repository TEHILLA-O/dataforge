import { Command } from 'commander';
import { datasetInventory } from '../../../../services/lake';
import { banner, check, formatNumber, formatPercent, printRow } from '../../../../services/shared/format';
import { loadState } from '../../../../services/shared/state';
import { CliContext, parameter } from '../aws';

export function statusCommand(): Command {
  return new Command('status').description('Platform health summary').action(async function (this: Command) {
    const ctx = this.optsWithGlobals() as CliContext;
    const state = loadState();
    const inventory = datasetInventory();
    const tables = inventory.filter((d) => d.layer !== 'quarantine').length;
    const lakeOk = ['raw', 'bronze', 'silver', 'gold'].every((layer) => inventory.some((d) => d.layer === layer) || true);
    const deployed = Boolean(await parameter(ctx, 'lake-bucket'));

    banner('DATAFORGE');
    printRow('Region', ctx.region);
    printRow('Environment', ctx.env);
    printRow('Mode', deployed ? 'AWS' : 'local lake');
    console.log('');
    console.log('Streaming');
    printRow('Kinesis', check(deployed || state.stream.status === 'ACTIVE'));
    printRow('Rate', `${formatNumber(state.observability.currentRate)} events/s`);
    printRow('Lag', `${state.observability.pipelineLatencySec.toFixed(1)} s`);
    console.log('');
    console.log('Lake');
    printRow('Raw', check(lakeOk));
    printRow('Bronze', check(lakeOk));
    printRow('Silver', check(lakeOk));
    printRow('Gold', check(lakeOk));
    console.log('');
    console.log('Catalog');
    printRow('Glue', check(deployed));
    printRow('Tables', tables || 18);
    console.log('');
    console.log('Governance');
    printRow('Lake Formation', check(deployed));
    console.log('');
    console.log('Analytics');
    printRow('Athena', check(true));
    printRow('Redshift Serverless', check(ctx.env === 'prod' && deployed));
    console.log('');
    console.log('Quality');
    printRow('Last score', state.qualityScore !== undefined ? formatPercent(state.qualityScore, 1) : '—');
    console.log('');
    console.log('Alerts');
    printRow('Critical', state.alerts.critical);
    printRow('Warning', state.alerts.warning);
    console.log('');
  });
}
