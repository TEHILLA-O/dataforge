#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { applyStandardTags } from '../lib/aspects/tagging';
import { resolveEnvironment } from '../lib/config';
import { stackName } from '../lib/config/naming';
import { AnalyticsStack } from '../stacks/analytics-stack';
import { GlueStack } from '../stacks/glue-stack';
import { GovernanceStack } from '../stacks/governance-stack';
import { MonitoringStack } from '../stacks/monitoring-stack';
import { NetworkStack } from '../stacks/network-stack';
import { OrchestrationStack } from '../stacks/orchestration-stack';
import { SecurityStack } from '../stacks/security-stack';
import { StorageStack } from '../stacks/storage-stack';
import { StreamingStack } from '../stacks/streaming-stack';

const app = new cdk.App();
const forgeEnv = resolveEnvironment(app.node.tryGetContext('env'));

const env = {
  account: forgeEnv.account || process.env.CDK_DEFAULT_ACCOUNT,
  region: forgeEnv.region,
};

const network = new NetworkStack(app, stackName(forgeEnv.name, 'Network'), { forgeEnv, env });
const storage = new StorageStack(app, stackName(forgeEnv.name, 'Storage'), { forgeEnv, env });
const streaming = new StreamingStack(app, stackName(forgeEnv.name, 'Streaming'), { forgeEnv, storage, env });
const glue = new GlueStack(app, stackName(forgeEnv.name, 'Glue'), { forgeEnv, storage, streaming, env });
new GovernanceStack(app, stackName(forgeEnv.name, 'Governance'), { forgeEnv, storage, glue, env });
new AnalyticsStack(app, stackName(forgeEnv.name, 'Analytics'), { forgeEnv, storage, network, env });
new OrchestrationStack(app, stackName(forgeEnv.name, 'Orchestration'), { forgeEnv, storage, glue, env });
new MonitoringStack(app, stackName(forgeEnv.name, 'Monitoring'), { forgeEnv, streaming, env });
new SecurityStack(app, stackName(forgeEnv.name, 'Security'), { forgeEnv, storage, env });

applyStandardTags(app, forgeEnv);

app.synth();
