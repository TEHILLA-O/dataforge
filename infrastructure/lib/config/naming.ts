import { EnvironmentName } from './types';

export function stackName(env: EnvironmentName, suffix: string): string {
  const prefix =
    env === 'prod' ? 'DataForgeProd' : env === 'stage' ? 'DataForgeStage' : 'DataForgeDev';
  return `${prefix}-${suffix}`;
}

export function resourceName(env: EnvironmentName, suffix: string): string {
  const prefix = env === 'prod' ? 'dataforge-prod' : env === 'stage' ? 'dataforge-stage' : 'dataforge-dev';
  return `${prefix}-${suffix}`;
}

export function streamName(env: EnvironmentName): string {
  return resourceName(env, 'transactions');
}

export function catalogDatabase(env: EnvironmentName, layer: string): string {
  return `dataforge_${env}_${layer}`;
}
