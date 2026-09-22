# Failure modes, fixes, and results

Honest engineering notes for this project. Nothing here is invented for polish.

## What can go wrong

- **Missing values, duplicates, late events, invalid schemas, fraud-like rows.** The generator injects these on purpose. Impact: dirty lake / wrong analytics. Mitigation: quality engine, quarantine/ prefix instead of silent drop (`README`).
- **Schema drift breaking Glue/Athena readers.** Impact: job failures. Mitigation: schema registry / evolution docs (`docs/SCHEMA-EVOLUTION.md`).
- **PII leaking into gold analytics.** Impact: compliance failure. Mitigation: masking/hashing/tokenisation and Lake Formation column permissions (`docs/SECURITY.md`, governance docs).
- **Leaving expensive AWS resources running.** Impact: bill shock. Mitigation: CLI local medallion lake demo without a long-lived expensive estate.

## What went wrong

**No recorded production incident in this repo yet.** Bad records in the quality report example are **synthetic** injections from `dataforge generate`, not a live outage.

## How it was resolved

- Quality, lineage, and quarantine paths are first-class services in the repo layout.
- Local lake writer lets you demonstrate medallion flow without leaving Kinesis/Redshift on.
- Cost model and governance docs spell out FinOps and access controls for a real deploy.

## Results

- README example quality report (generator scenario): completeness/validity/uniqueness in the high 99%s and quality score **98.7 / 100** on 2,500 synthetic records. Treat that as a demo output format, not a production SLA.
- Successful demo: `dataforge generate --scenario payments ...` then inspect quarantine and Athena/local lake outputs per README.
