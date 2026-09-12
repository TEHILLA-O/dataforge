import { Command } from 'commander';
import { diffSchemas, listSchemas } from '../../../../services/schema-registry';
import { banner, printRow } from '../../../../services/shared/format';

export function schemaCommand(): Command {
  const cmd = new Command('schema').description('Schema registry and compatibility');

  cmd
    .command('list')
    .description('Registered schema versions')
    .action(() => {
      banner('SCHEMAS');
      for (const schema of listSchemas()) {
        printRow(`${schema.name}-v${schema.version}`, `${schema.fields.length} fields`);
      }
      console.log('');
    });

  cmd
    .command('diff')
    .description('Compare two schema versions')
    .argument('<left>', 'transaction-v1')
    .argument('<right>', 'transaction-v2')
    .action((left: string, right: string) => {
      const diff = diffSchemas(left, right);
      banner('SCHEMA DIFFERENCE');
      console.log('');
      console.log('Added:');
      if (diff.added.length === 0) console.log('None');
      else for (const field of diff.added) console.log(`+ ${field.name}:${field.type}`);
      console.log('');
      console.log('Removed:');
      if (diff.removed.length === 0) console.log('None');
      else for (const field of diff.removed) console.log(`- ${field.name}:${field.type}`);
      console.log('');
      console.log('Changed:');
      if (diff.changed.length === 0) console.log('None');
      else for (const field of diff.changed) console.log(`~ ${field.name}: ${field.from} → ${field.to}`);
      console.log('');
      console.log('Compatibility:');
      console.log(diff.compatibility);
      console.log('');
    });

  return cmd;
}
