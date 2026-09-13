# Contributing

Thanks for helping with DataForge. Changes should match what the CDK stacks and TypeScript services actually do.

## Prerequisites

- Node.js 20 or newer
- npm (lockfile is committed)
- An AWS account and profile only if you intend to bootstrap or deploy
- Docker is not required for `cdk synth`

## Setup

```bash
cp .env.example .env
npm install
```

## Local demo (no AWS required)

```bash
npm test
npm run synth
npm run dataforge -- generate --scenario payments --rate 80 --duration 5s
npm run dataforge -- quality transactions
npm run dataforge -- lineage gold.daily_revenue
```

## Build and lint

```bash
npm run build
npm run lint
```

## Deploy (optional)

```bash
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION
npm run deploy:dev
```

Tear down when finished:

```bash
npm run destroy:dev
```

Set `DATAFORGE_NOTIFY_EMAIL` before deploy if you want anomaly mail. Prefer the `dev` profile for day-to-day work; do not leave `prod` running between sessions.

## Guidelines

- Prefer CDK and typed services over undocumented console changes.
- Keep cost assumptions aligned with `docs/COST-MODEL.md`.
- Quarantine bad records; do not silently drop them.
- Keep commit messages short and human.
