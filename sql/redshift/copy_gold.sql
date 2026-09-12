COPY fact_transaction
FROM 's3://{{LAKE_BUCKET}}/gold/daily_revenue/'
IAM_ROLE '{{REDSHIFT_ROLE_ARN}}'
FORMAT AS PARQUET;
