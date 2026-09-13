# Architecture

DataForge is a streaming lakehouse for an online financial platform. Simulated payments, logs and IoT telemetry land on Kinesis, are enriched and quality-checked, then stored as Parquet in a governed S3 medallion lake.

```
                           DATA PRODUCERS
                    ┌──────────┼──────────┐
                    ↓          ↓          ↓
               Transactions   Logs      IoT Events
                    │          │          │
                    └──────────┼──────────┘
                               ↓
                    Kinesis Data Streams
                               │
                  ┌────────────┴────────────┐
                  ↓                         ↓
             Lambda Enrichment        Glue Streaming ETL
                  │                         │
                  └────────────┬────────────┘
                               ↓
                         S3 DATA LAKE
                    raw / bronze / silver / gold
                               │
                         Glue Catalog
                               │
                       Lake Formation
           ┌───────────────────┼───────────────────┐
           ↓                   ↓                   ↓
        Athena        Redshift Serverless      SageMaker
           │                   │
           └───────────┬───────┘
                       ↓
                  QuickSight
```

```
                    ANOMALY PATH
                         │
                     CloudWatch
                         │
                     EventBridge
                         │
                       Lambda
                         │
                        SNS
```

```
                    BATCH PATH
                         │
                   Step Functions
          Validate → Discover → Glue → Quality
                         │
                    PASS / FAIL
                   Catalog / Quarantine
```

## Stacks

| Stack | Responsibility |
| --- | --- |
| `Network` | Two-AZ VPC, explicit CIDRs, optional NAT, S3/DynamoDB gateway endpoints |
| `Storage` | KMS, lake bucket, access logs, Athena results |
| `Streaming` | On-demand Kinesis, Lambda enricher, event source mapping |
| `Glue` | Catalog databases, projection-partitioned tables, batch + optional streaming jobs |
| `Governance` | Lake Formation registration, persona IAM roles, column grants |
| `Analytics` | Athena workgroup, named queries, Redshift Serverless (`prod`) |
| `Orchestration` | Step Functions batch pipeline |
| `Monitoring` | Dashboard, iterator-age alarm, anomaly Lambda, SNS |
| `Security` | Deny insecure transport and unencrypted puts |

CDK TypeScript is the only deployment mechanism. There is no click-ops path.

## Why both Lambda and Glue

Lambda writes **raw** JSON quickly so you always have an exact copy of the stream. Glue streaming is the production transformer: schema validation, quarantine routing, deduplication, derived fields, date partitions, Parquet. Dev leaves the Glue streaming job defined-off so a forgotten deploy does not burn DPU-hours.

## Partition keys

| Scenario | Key |
| --- | --- |
| payments / ecommerce / banking / fraud | `customer_id` |
| iot | `device_id` |
| logs | `service` |

Hot customers can skew a shard. That is a talking point, not a surprise: on-demand Kinesis still splits, and gold aggregates do not depend on shard order.

## Local mode

The same TypeScript engines the Lambdas import also write `.dataforge/lake/`. `dataforge generate` therefore produces raw, bronze, silver, gold, quarantine, quality and lineage without an AWS account. Interviewers can run the CLI in under a minute; deploy is the second conversation.

## Repository layout

```
infrastructure/   CDK app and stacks (network, storage, streaming, glue, governance, ...)
services/         event-generator, enrichment, quality-engine, anomaly-detector, schema-registry,
                  lineage, pii, lake (local medallion writer), backfill
glue/             streaming and batch job code
cli/dataforge/    Commander CLI used for generate, quality, lineage, query, deploy, destroy
schemas/          event and table schemas
sql/              Athena and Redshift queries
dashboards/       operational views
workflows/        Step Functions definitions
tests/            Jest unit and synth-oriented tests
docs/             architecture, cost, lake, quality, governance, lineage, schema, security
```

## Control flow (CLI local path)

1. `dataforge generate` produces simulated financial (or related) events with deliberate defects.
2. With `--sink local` (default), the TypeScript lake writer under `services/lake` materialises medallion folders under `.dataforge/lake/`.
3. `dataforge quality` and `dataforge lineage` read that local lake so demos do not require a live AWS bill.
4. After `cdk deploy`, `--sink kinesis` puts records on the live stream for the enrichment and Glue paths described above.
