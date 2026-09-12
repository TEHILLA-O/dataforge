# Data quality

Every batch is scored before it is allowed to look like gold.

| Dimension | Rule |
| --- | --- |
| Completeness | required fields present (`event_id`, `event_type`, `timestamp`, plus `customer_id` / `amount` / `currency` for financial datasets) |
| Validity | currency in {GBP,EUR,USD,JPY}, amount ≥ 0, timestamp not in the future, schema parseable |
| Uniqueness | `event_id` seen once |

Score = 0.4·completeness + 0.4·validity + 0.2·uniqueness.

Failed rows are copied to `quarantine/`. They are not deleted. That lets SecurityAnalyst inspect fraud-shaped or malformed traffic and lets a backfill replay after a producer fix.

The generator exists to fail these checks on purpose. A pipeline that only ever sees clean JSON is not a data platform.
