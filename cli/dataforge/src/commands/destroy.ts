import { Command } from 'commander';
import { run } from './deploy';
import { CliContext } from '../aws';

export function destroyCommand(): Command {
  return new Command('destroy')
    .description('Tear down a disposable environment (dev is the intended target)')
    .argument('[profile]', 'dev | stage | prod', 'dev')
    .action(async function (this: Command, profile: string) {
      const ctx = this.optsWithGlobals() as CliContext;
      const env = profile || ctx.env;
      if (env === 'prod') {
        console.log('prod retains the lake bucket. Confirm in CloudFormation if destroy hangs on S3.');
      }
      await run('npx', ['cdk', 'destroy', '--all', '-c', `env=${env}`, '--force']);
    });
}
