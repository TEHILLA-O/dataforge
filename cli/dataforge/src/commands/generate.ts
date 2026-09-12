import { Command } from 'commander';
import { EventGenerator, scenarioFromArgs } from '../../../../services/event-generator';
import { writeEvents } from '../../../../services/lake';
import { parseDuration, formatNumber } from '../../../../services/shared/format';
import { loadState, saveState } from '../../../../services/shared/state';
import { FinancialEvent } from '../../../../services/shared/types';
import { CliContext, parameter, putRecords } from '../aws';

export function generateCommand(): Command {
  return new Command('generate')
    .description('Simulate business events into the local lake or Kinesis')
    .argument('[scenario]', 'ecommerce | payments | banking | iot | logs | fraud', 'ecommerce')
    .option('--scenario <name>', 'override positional scenario')
    .option('--rate <n>', 'events per second', '50')
    .option('--duration <span>', 'how long to run (10s, 5m, 1h)', '8s')
    .option('--sink <name>', 'local | kinesis | stdout', 'local')
    .option('--seed <n>', 'deterministic seed')
    .action(async function (this: Command, scenarioArg: string) {
      const ctx = this.optsWithGlobals() as CliContext;
      const opts = this.opts() as {
        scenario?: string;
        rate: string;
        duration: string;
        sink: string;
        seed?: string;
      };
      const scenario = scenarioFromArgs(opts.scenario || scenarioArg);
      const rate = Math.max(1, Number(opts.rate));
      const durationMs = parseDuration(opts.duration);
      const generator = new EventGenerator({
        scenario,
        seed: opts.seed ? Number(opts.seed) : Date.now() % 1_000_000,
      });

      const started = Date.now();
      let produced = 0;
      let failed = 0;
      let bytes = 0;
      let quarantined = 0;
      let lastScore = 100;
      const deadline = started + durationMs;
      const streamName = opts.sink === 'kinesis' ? await parameter(ctx, 'stream-name') : undefined;
      if (opts.sink === 'kinesis' && !streamName) {
        throw new Error('Kinesis stream name not in SSM. Deploy the Streaming stack or use --sink local.');
      }

      process.stderr.write(`dataforge generate  scenario=${scenario}  rate=${rate}/s  duration=${opts.duration}\n`);

      while (Date.now() < deadline) {
        const tickStart = Date.now();
        const batch = generator.nextBatch(rate);
        produced += batch.length;
        bytes += batch.reduce((sum, e) => sum + Buffer.byteLength(JSON.stringify(e)), 0);

        if (opts.sink === 'stdout') {
          for (const event of batch) console.log(JSON.stringify(event));
        } else if (opts.sink === 'kinesis' && streamName) {
          const result = await putRecords(ctx, streamName, batch, (e) => generator.partitionKey(e));
          failed += result.failed;
        } else {
          const written = writeEvents(datasetFor(scenario), batch as FinancialEvent[]);
          quarantined += written.quarantined;
          lastScore = written.quality.score;
        }

        const elapsed = Date.now() - tickStart;
        if (elapsed < 1000) await sleep(1000 - elapsed);
      }

      const actualSec = Math.max((Date.now() - started) / 1000, 0.001);
      const state = loadState();
      state.lastGenerate = {
        scenario,
        rate,
        durationMs,
        events: produced,
        failed,
        at: new Date().toISOString(),
        sink: opts.sink,
      };
      state.stream = {
        stream: streamName || 'transactions-local',
        status: 'ACTIVE',
        shards: 4,
        incomingRecordsPerSec: produced / actualSec,
        incomingBytesPerSec: bytes / actualSec,
        iteratorAgeMs: 12,
        failedRecords: failed,
        lastMinuteEvents: produced,
      };
      state.observability.eventsToday += produced;
      state.observability.currentRate = produced / actualSec;
      state.observability.quarantined += quarantined;
      state.observability.dataQuality = lastScore;
      state.qualityScore = lastScore;
      if (lastScore < 97) state.alerts.warning += 1;
      saveState(state);

      console.log('');
      console.log(`Generated           ${formatNumber(produced)} events`);
      console.log(`Effective rate      ${(produced / actualSec).toFixed(1)}/s`);
      console.log(`Failed              ${failed}`);
      console.log(`Quality             ${lastScore.toFixed(1)} / 100`);
      console.log(`Quarantined         ${formatNumber(quarantined)}`);
      console.log('');
    });
}

function datasetFor(scenario: string): string {
  if (scenario === 'iot') return 'iot';
  if (scenario === 'logs') return 'logs';
  return 'transactions';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
