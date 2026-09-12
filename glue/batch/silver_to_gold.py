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
silver = spark.read.parquet(f"s3://{bucket}/silver/transactions/")

daily = silver.groupBy(F.to_date("timestamp").alias("metric_date")).agg(
    F.count("*").alias("transactions"),
    F.sum("amount_gbp").alias("volume"),
    F.sum(F.col("is_fraud").cast("int")).alias("fraud"),
)
daily.write.mode("overwrite").parquet(f"s3://{bucket}/gold/daily_revenue/")

country = silver.groupBy("country").agg(
    F.count("*").alias("transactions"),
    F.sum("amount_gbp").alias("volume"),
)
country.write.mode("overwrite").parquet(f"s3://{bucket}/gold/country_performance/")

customers = silver.groupBy("customer_id").agg(
    F.count("*").alias("transactions"),
    F.sum("amount_gbp").alias("volume"),
)
customers.write.mode("overwrite").parquet(f"s3://{bucket}/gold/customer_activity/")

fraud = silver.filter(F.col("is_fraud") == True).groupBy(F.to_date("timestamp").alias("metric_date")).agg(
    F.count("*").alias("fraud_events"),
    F.avg("risk_score").alias("avg_risk"),
)
fraud.write.mode("overwrite").parquet(f"s3://{bucket}/gold/fraud_summary/")

merchants = silver.groupBy("merchant_category").agg(
    F.count("*").alias("transactions"),
    F.sum("amount_gbp").alias("volume"),
)
merchants.write.mode("overwrite").parquet(f"s3://{bucket}/gold/merchant_statistics/")

job.commit()
