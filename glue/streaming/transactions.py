"""
Glue Structured Streaming job.

Kinesis JSON  →  validate / normalize / enrich  →  Parquet on S3
Invalid rows are written to quarantine/ instead of being dropped.
"""
import sys
from datetime import datetime

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, StringType, StructField, StructType

args = getResolvedOptions(sys.argv, ["JOB_NAME", "LAKE_BUCKET", "STREAM_NAME", "ENV"])
sc = SparkContext()
glue = GlueContext(sc)
spark = glue.spark_session
job = Job(glue)
job.init(args["JOB_NAME"], args)

schema = StructType(
    [
        StructField("event_id", StringType(), True),
        StructField("customer_id", StringType(), True),
        StructField("event_type", StringType(), True),
        StructField("amount", DoubleType(), True),
        StructField("currency", StringType(), True),
        StructField("country", StringType(), True),
        StructField("device", StringType(), True),
        StructField("timestamp", StringType(), True),
        StructField("merchant_id", StringType(), True),
        StructField("merchant_category", StringType(), True),
        StructField("email", StringType(), True),
        StructField("phone", StringType(), True),
        StructField("ip_address", StringType(), True),
        StructField("customer_name", StringType(), True),
        StructField("schema_version", StringType(), True),
        StructField("risk_score", DoubleType(), True),
    ]
)

raw = (
    spark.readStream.format("kinesis")
    .option("streamName", args["STREAM_NAME"])
    .option("startingPosition", "LATEST")
    .load()
)

parsed = raw.select(F.from_json(F.col("data").cast("string"), schema).alias("e")).select("e.*")

valid = (
    parsed.filter(F.col("event_id").isNotNull())
    .filter(F.col("customer_id").isNotNull())
    .filter(F.col("amount").isNotNull() & (F.col("amount") >= 0))
    .filter(F.col("currency").isin("GBP", "EUR", "USD", "JPY"))
    .dropDuplicates(["event_id"])
    .withColumn("ingested_at", F.current_timestamp())
    .withColumn("event_date", F.to_date(F.col("timestamp")))
    .withColumn("year", F.date_format(F.col("timestamp"), "yyyy"))
    .withColumn("month", F.date_format(F.col("timestamp"), "MM"))
    .withColumn("day", F.date_format(F.col("timestamp"), "dd"))
    .withColumn("hour", F.date_format(F.col("timestamp"), "HH"))
    .withColumn("is_fraud", F.col("risk_score") >= F.lit(0.8))
)

invalid = parsed.join(valid.select("event_id"), "event_id", "left_anti").withColumn(
    "quarantine_reason", F.lit("schema_or_quality")
)

bucket = args["LAKE_BUCKET"]
checkpoint = f"s3://{bucket}/_checkpoints/streaming-transactions/"

(
    valid.writeStream.format("parquet")
    .option("path", f"s3://{bucket}/bronze/transactions/")
    .option("checkpointLocation", checkpoint + "bronze/")
    .partitionBy("year", "month", "day", "hour")
    .outputMode("append")
    .start()
)

(
    invalid.writeStream.format("json")
    .option("path", f"s3://{bucket}/quarantine/transactions/")
    .option("checkpointLocation", checkpoint + "quarantine/")
    .outputMode("append")
    .start()
)

spark.streams.awaitAnyTermination()
job.commit()
