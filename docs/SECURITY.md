# Security

- S3: Block Public Access, TLS-only bucket policy, KMS-encrypted objects, bucket keys, access logs.
- Kinesis: KMS encryption, on-demand so unused shards do not sit around.
- Glue / Lambda: least-privilege roles; stream read and lake write only.
- PII columns (`email`, `phone`, `ip_address`, `customer_name`, `address`) are marked in the schema registry, masked in silver, and denied to FinanceAnalyst in Lake Formation.
- Redshift Serverless (`prod`) is private: isolated subnets, no public access.
- No long-lived GitHub access keys. Deploy uses OIDC.

Personas and column grants: [GOVERNANCE.md](GOVERNANCE.md).
