import { Command } from 'commander';
import { lineageOf, renderLineage } from '../../../../services/lineage';
import { banner } from '../../../../services/shared/format';

export function lineageCommand(): Command {
  return new Command('lineage')
    .description('Show dataset and field-level lineage')
    .argument('<target>', 'gold.daily_revenue')
    .action((target: string) => {
      const graph = lineageOf(target);
      banner(graph.target);
      console.log('');
      console.log(renderLineage(graph));
      console.log('');
      for (const transform of graph.transforms) {
        for (let i = 0; i < transform.steps.length; i++) {
          const step = transform.steps[i];
          if (isLineageNode(step)) {
            console.log(step);
            const next = transform.steps[i + 1];
            if (next && !isLineageNode(next)) console.log(`     ↓ ${next}`);
          }
        }
        console.log('');
      }
    });
}

function isLineageNode(step: string): boolean {
  return /^(RAW|BRONZE|SILVER|GOLD|FACT)[._]/.test(step);
}
