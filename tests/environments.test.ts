import { DEV, PROD, STAGE, resolveEnvironment } from '../infrastructure/lib/config';

describe('environment profiles', () => {
  it('defaults to the disposable dev lab', () => {
    const env = resolveEnvironment();
    expect(env.name).toBe('dev');
    expect(env.vpc.natGateways).toBe(0);
    expect(env.streaming.enableGlueStreaming).toBe(false);
    expect(env.analytics.enableRedshift).toBe(false);
    expect(env.streaming.streamMode).toBe('ON_DEMAND');
  });

  it('keeps stage on Glue streaming without a warehouse', () => {
    expect(STAGE.streaming.enableGlueStreaming).toBe(true);
    expect(STAGE.analytics.enableRedshift).toBe(false);
    expect(STAGE.vpc.natGateways).toBe(1);
  });

  it('enables Redshift Serverless only on prod', () => {
    expect(PROD.analytics.enableRedshift).toBe(true);
    expect(PROD.analytics.redshiftBaseCapacityRpu).toBe(8);
    expect(DEV.cost.monthlyBudget).toBeLessThan(PROD.cost.monthlyBudget);
  });
});
