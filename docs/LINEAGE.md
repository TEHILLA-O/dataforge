# Lineage

```
dataforge lineage gold.daily_revenue
```

```
gold.daily_revenue
        ↑
silver.transactions
        ↑
bronze.transactions
        ↑
raw/kinesis/transactions
        ↑
Kinesis Data Stream
        ↑
transaction-generator
```

```
RAW.amount
     ↓ cast decimal
BRONZE.amount
     ↓ remove invalid values
SILVER.amount
     ↓ SUM
GOLD.daily_revenue
```

The catalog is code (`services/lineage`), not a scraped UI. That is deliberate: field-level lineage is a design artefact you can defend, version and test. Glue / SageMaker lineage can sit on top later; the CLI already answers “where did this number come from?”
