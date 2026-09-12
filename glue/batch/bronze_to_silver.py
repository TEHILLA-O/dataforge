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
bronze = spark.read.parquet(f"s3://{bucket}/bronze/transactions/")

country = spark.createDataFrame(
    [
        ("GB", "United Kingdom"),
        ("IE", "Ireland"),
        ("FR", "France"),
        ("DE", "Germany"),
        ("US", "United States"),
        ("NL", "Netherlands"),
        ("ES", "Spain"),
        ("IT", "Italy"),
        ("SE", "Sweden"),
        ("NO", "Norway"),
    ],
    ["country", "country_name"],
)

silver = (
    bronze.dropDuplicates(["event_id"])
    .filter(F.col("customer_id").isNotNull())
    .withColumn("amount", F.col("amount").cast("double"))
    .withColumn(
        "amount_gbp",
        F.when(F.col("currency") == "GBP", F.col("amount"))
        .when(F.col("currency") == "EUR", F.col("amount") * 0.85)
        .when(F.col("currency") == "USD", F.col("amount") * 0.78)
        .when(F.col("currency") == "JPY", F.col("amount") * 0.0052)
        .otherwise(F.col("amount")),
    )
    .join(country, "country", "left")
    .withColumn("email", F.concat(F.substring(F.col("email"), 1, 1), F.lit("******@"), F.split(F.col("email"), "@").getItem(1)))
)

(
    silver.write.mode("overwrite")
    .partitionBy("year", "month", "day", "hour")
    .parquet(f"s3://{bucket}/silver/transactions/")
)
job.commit()
