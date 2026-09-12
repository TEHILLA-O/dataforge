# Schema evolution

```
dataforge schema diff transaction-v1 transaction-v2
```

```
SCHEMA DIFFERENCE

Added:
+ merchant_id:string
+ merchant_category:string

Removed:
None

Changed:
None

Compatibility:
BACKWARD COMPATIBLE
```

| Change | Classification |
| --- | --- |
| Add optional field | BACKWARD COMPATIBLE |
| Remove optional field | FORWARD COMPATIBLE |
| Add/remove required field or change type | BREAKING |

v1 is the payment core. v2 adds merchant context. v3 adds PII and `risk_score`. Consumers on v1 can ignore the new fields; producers on v1 still satisfy v2/v3 readers because the additions are optional.

Glue streaming uses a permissive struct and writes unknown extra keys only into raw JSON, so a breaking change lands in quarantine instead of poisoning Parquet.
