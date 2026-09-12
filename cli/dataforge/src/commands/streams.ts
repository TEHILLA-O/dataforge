import { Command } from 'commander';
import { banner, formatBytes, formatNumber, printRow } from '../../../../services/shared/format';
import { loadState } from '../../../../services/shared/state';
import { CliContext, describeStream, parameter, streamMetrics } from '../aws';

export function streamsCommand(): Command {
  const cmd = new Command('streams').description('List or inspect Kinesis streams');
  cmd.action(async function (this: Command) {
    const ctx = this.optsWithGlobals() as CliContext;
    const name = (await parameter(ctx, 'stream-name')) || loadState().stream.stream;
    banner('DATAFORGE STREAMS');
    printRow('Stream', name);
    printRow('Environment', ctx.env);
    console.log('');
  });
  cmd
    .command('status')
    .description('Live stream throughput and iterator age')
    .action(async function (this: Command) {
      const ctx = this.optsWithGlobals() as CliContext;
      const state = loadState();
      const name = (await parameter(ctx, 'stream-name')) || state.stream.stream;
      let snapshot = state.stream;
      try {
        const live = await describeStream(ctx, name);
        const metrics = await streamMetrics(ctx, name);
        snapshot = {
          stream: name,
          status: live.status,
          shards: live.shards,
          incomingRecordsPerSec: metrics.incomingRecords,
          incomingBytesPerSec: metrics.incomingBytes,
          iteratorAgeMs: metrics.iteratorAge,
          failedRecords: state.stream.failedRecords,
          lastMinuteEvents: Math.round(metrics.incomingRecords * 60),
        };
      } catch {
        snapshot = { ...state.stream, stream: name };
      }

      banner('DATAFORGE STREAM');
      console.log('');
      printRow('Stream', snapshot.stream);
      printRow('Status', snapshot.status);
      console.log('');
      printRow('Shards', snapshot.shards);
      console.log('');
      printRow('Incoming records', `${formatNumber(snapshot.incomingRecordsPerSec, 0)}/s`);
      printRow('Incoming bytes', `${formatBytes(snapshot.incomingBytesPerSec)}/s`);
      console.log('');
      printRow('Iterator age', `${formatNumber(snapshot.iteratorAgeMs)} ms`);
      console.log('');
      printRow('Failed records', snapshot.failedRecords);
      console.log('');
      printRow('Last minute', `${formatNumber(snapshot.lastMinuteEvents)} events`);
      console.log('');
    });
  return cmd;
}
