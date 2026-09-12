import { Tags } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';
import { DataForgeEnvironment, STANDARD_TAGS } from '../config';

export function applyStandardTags(scope: IConstruct, environment: DataForgeEnvironment): void {
  const envLabel = environment.name === 'prod' ? 'Prod' : environment.name === 'stage' ? 'Stage' : 'Dev';
  Tags.of(scope).add('Project', STANDARD_TAGS.Project);
  Tags.of(scope).add('Environment', envLabel);
  Tags.of(scope).add('Owner', STANDARD_TAGS.Owner);
  Tags.of(scope).add('ManagedBy', STANDARD_TAGS.ManagedBy);
  Tags.of(scope).add('CostCenter', 'Portfolio-DataForge');
}
