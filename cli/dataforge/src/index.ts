#!/usr/bin/env node
import { Command } from 'commander';
import { backfillCommand } from './commands/backfill';
import { costsCommand } from './commands/costs';
import { datasetsCommand } from './commands/datasets';
import { deployCommand } from './commands/deploy';
import { destroyCommand } from './commands/destroy';
import { generateCommand } from './commands/generate';
import { lineageCommand } from './commands/lineage';
import { qualityCommand } from './commands/quality';
import { queryCommand } from './commands/query';
import { schemaCommand } from './commands/schema';
import { statusCommand } from './commands/status';
import { streamsCommand } from './commands/streams';

const program = new Command();

program
  .name('dataforge')
  .description('DataForge — generate, inspect and govern an AWS data lakehouse from the command line')
  .version('1.0.0')
  .option('-e, --env <name>', 'dev | stage | prod', process.env.DATAFORGE_ENV || 'dev')
  .option('-r, --region <region>', 'AWS region', process.env.AWS_REGION || process.env.CDK_DEFAULT_REGION || 'eu-west-2');

program.addCommand(statusCommand());
program.addCommand(generateCommand());
const streams = streamsCommand();
program.addCommand(streams);
program.addCommand(streamsCommand().name('stream').description('Alias for streams'));
program.addCommand(datasetsCommand());
program.addCommand(schemaCommand());
program.addCommand(qualityCommand());
program.addCommand(lineageCommand());
program.addCommand(queryCommand());
program.addCommand(backfillCommand());
program.addCommand(costsCommand());
program.addCommand(deployCommand());
program.addCommand(destroyCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`dataforge: ${message}`);
  process.exitCode = 1;
});
