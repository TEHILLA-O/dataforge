# Data lake

```
s3://dataforge-lake/
  raw/        year=/month=/day=/hour=/
  bronze/
  silver/
  gold/
  quarantine/
```

| Layer | Meaning | Format |
| --- | --- | --- |
| RAW | Exact incoming event, including defects | JSON |
| BRONZE | Parsed, schema-validated | Parquet |
| SILVER | Deduplicated, enriched, PII masked | Parquet |
| GOLD | Business datasets | Parquet |
| QUARANTINE | Failed quality / schema | JSON |

## Gold datasets

| Dataset | Grain | Question it answers |
| --- | --- | --- |
| `daily_revenue` | day | What did we take? |
| `customer_activity` | customer | Who is active? |
| `country_performance` | country | Where is volume? |
| `fraud_summary` | day | How much looks bad? |
| `merchant_statistics` | category | Which merchants? |
| `system_performance` | day | Is the pipe healthy? |

Hive-style partitions (`year=2026/month=09/day=12/hour=21`) plus Glue partition projection mean Athena does not need a crawler on every hour.

## Local equivalent

`DATAFORGE_LAKE_DIR` (default `.dataforge/lake`) mirrors the prefixes. The generator and backfill writer use the same layout so `dataforge query` and `dataforge quality` stay honest when AWS is off.
