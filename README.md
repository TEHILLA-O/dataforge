# DataForge

**AWS real-time data lakehouse, streaming analytics and data governance platform.**

See [FAILURES.md](./FAILURES.md) for what can go wrong, what broke, how it was fixed, and results.

Where AegisCloud proves cloud infrastructure, DevOps and security, DataForge proves AWS data engineering: streaming ingestion, a governed S3 medallion lake, schema evolution, quality, lineage and analytics.

The platform ingests simulated financial events, processes them in near real time, stores them in a governed S3 lake, makes them queryable through Athena (and Redshift Serverless in `prod`), and raises anomaly alerts.

```
dataforge generate --scenario payments --rate 250 --duration 10s
```

```
DATA QUALITY REPORT

Dataset
transactions

Records                   2,500

Completeness              99.40%
Validity                  99.12%
Uniqueness                99.64%

QUALITY SCORE

98.7 / 100
```

The generator deliberately injects missing values, duplicates, late events, invalid schemas and fraud-like rows. Bad records go to `quarantine/` instead of disappearing. That is the point of the project.

This follows real AWS data-platform patterns — Kinesis, Glue, Lake Formation, Athena, Redshift Serverless, Step Functions — not a mocked portfolio diagram. The CLI also runs a local lake so you can demo without leaving a bill running.

---

## What you can talk about in an interview

Kinesis Data Streams · Lambda enrichment · Glue streaming ETL · Spark Structured Streaming · S3 data lake · medallion architecture (raw / bronze / silver / gold) · Glue Data Catalog · Lake Formation · column-level permissions · PII masking / hashing / tokenisation · Athena · Redshift Serverless · star schema · data quality · schema evolution · data lineage · backfill / checkpoints · Step Functions · CloudWatch · EventBridge · SNS · anomaly detection · QuickSight · CDK · FinOps for analytics

The events are deliberately simple. The engineering is the lake around them.

---

## Repository

```
├── infrastructure/
│   ├── bin/dataforge.ts
│   ├── stacks/            network · storage · streaming · glue · governance
│   │                      analytics · orchestration · monitoring · security
│   └── constructs/
├── services/
│   ├── event-generator/
│   ├── enrichment/
│   ├── quality-engine/
│   ├── anomaly-detector/
│   ├── schema-registry/
│   ├── lineage/
│   ├── pii/
│   ├── lake/              local medallion writer
│   └── backfill/
├── glue/streaming + batch
├── cli/dataforge/
├── schemas/
├── sql/athena + redshift
├── dashboards/
├── tests/
└── docs/
```

## Architecture (short)

Producers → Kinesis (on-demand) → Lambda enrichment **and** Glue streaming ETL → S3 lake (`raw` / `bronze` / `silver` / `gold` / `quarantine`) → Glue Catalog → Lake Formation → Athena / Redshift Serverless → QuickSight.

Anomaly path: CloudWatch → EventBridge → Lambda → SNS.

Batch path: Step Functions (validate → discover → Glue → quality → catalog or quarantine → publish).

Full diagrams: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## CLI

```
dataforge status
dataforge generate --scenario ecommerce --rate 250 --duration 10s
dataforge streams status
dataforge datasets
dataforge schema list
dataforge schema diff transaction-v1 transaction-v2
dataforge quality transactions
dataforge lineage gold.daily_revenue
dataforge query "SELECT country, SUM(volume) FROM gold_country_performance GROUP BY country"
dataforge backfill --dataset transactions --from 2026-09-01 --to 2026-09-07 --dry-run
dataforge costs
dataforge deploy
dataforge destroy dev
```

`dataforge generate` writes a local medallion lake by default (`--sink local`). After deploy, `--sink kinesis` puts records into the live stream.

## Environments

| Profile | Intent | Budget | Always-on extras |
| --- | --- | --- | --- |
| `dev` | Disposable lab | £20 | Kinesis on-demand, S3, Lambda, Athena. No Glue streaming job, no Redshift, no NAT |
| `stage` | Streaming walkthrough | £45 | + Glue streaming, 1 NAT |
| `prod` | Interview warehouse shape | £80 | + Redshift Serverless (pauses when idle) |

Do not leave `prod` running between conversations. `dataforge destroy dev` is the cost off-switch.

[docs/COST-MODEL.md](docs/COST-MODEL.md)

## Prerequisites

- Node.js 20+
- AWS CDK v2 (`npm i` installs the CLI locally)
- An AWS account and a profile that can create IAM, S3, Kinesis, Glue, Lake Formation
- Optional: Docker is **not** required for synth

```bash
cp .env.example .env
npm install
npm test
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
npm run synth
npm run dataforge -- generate --scenario payments --rate 80 --duration 5s
npm run dataforge -- quality transactions
npm run dataforge -- lineage gold.daily_revenue
```

Set `DATAFORGE_NOTIFY_EMAIL` before deploy if you want anomaly mail.

Tear down:

```bash
npm run destroy:dev
# or
npx ts-node cli/dataforge/src/index.ts destroy dev
```

## CI/CD

GitHub Actions: test → `tsc` → `cdk synth` → deploy `dev` on `main` using **OIDC federation**. No long-lived access keys in repository secrets. Create an IAM role that trusts `token.actions.githubusercontent.com` and store its ARN as `AWS_DEPLOY_ROLE_ARN`.

## Related work

| Repo | Language | Story |
| --- | --- | --- |
| LedgerX | C# | FinTech / distributed systems |
| Sentinel | C# | Kafka / fraud / real-time |
| Atlas | Python | LangGraph / RAG / agents |
| VPSForge | Rust | Linux / VPS provisioning |
| AegisCloud | TypeScript / AWS | Cloud architecture, DevOps, security, self-healing |
| **DataForge** | **TypeScript / AWS** | **Data engineering, streaming, lakes, governance, analytics** |
