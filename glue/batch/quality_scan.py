import sys
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import functions as F

args = getResolvedOptions(sys.argv, ["JOB_NAME", "LAKE_BUCKET", "ENV"])
sc = SparkContext()
glue = GlueContext(sc)
spark = glue.spark_session
job = Job(glue)
job.init(args["JOB_NAME"], args)

bucket = args["LAKE_BUCKET"]
raw = spark.read.json(f"s3://{bucket}/raw/transactions/")

total = raw.count()
missing_customer = raw.filter(F.col("customer_id").isNull() | (F.col("customer_id") == "")).count()
invalid_currency = raw.filter(~F.col("currency").isin("GBP", "EUR", "USD", "JPY")).count()
negative = raw.filter(F.col("amount") < 0).count()
duplicates = raw.groupBy("event_id").count().filter(F.col("count") > 1).count()

score = 100.0
score -= (missing_customer / max(total, 1)) * 40
score -= (invalid_currency / max(total, 1)) * 30
score -= (negative / max(total, 1)) * 20
score -= (duplicates / max(total, 1)) * 10

report = spark.createDataFrame(
    [
        {
            "dataset": "transactions",
            "records": total,
            "missing_customer_id": missing_customer,
            "invalid_currency": invalid_currency,
            "negative_amount": negative,
            "duplicate_event_id": duplicates,
            "quality_score": round(score, 1),
        }
    ]
)
report.coalesce(1).write.mode("overwrite").json(f"s3://{bucket}/gold/quality_reports/")

if score < 95:
    raw.filter(
        F.col("customer_id").isNull()
        | ~F.col("currency").isin("GBP", "EUR", "USD", "JPY")
        | (F.col("amount") < 0)
    ).write.mode("append").json(f"s3://{bucket}/quarantine/transactions/")

job.commit()
