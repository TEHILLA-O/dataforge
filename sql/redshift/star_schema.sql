-- DataForge warehouse model. Loaded from gold/ by COPY after the batch pipeline.

CREATE TABLE IF NOT EXISTS dim_time (
    time_key    INTEGER PRIMARY KEY,
    date        DATE NOT NULL,
    hour        SMALLINT,
    weekday     VARCHAR(16),
    month       SMALLINT,
    year        SMALLINT
);

CREATE TABLE IF NOT EXISTS dim_customer (
    customer_key      INTEGER PRIMARY KEY,
    customer_id       VARCHAR(32) NOT NULL,
    customer_segment  VARCHAR(32),
    country           VARCHAR(8)
);

CREATE TABLE IF NOT EXISTS dim_merchant (
    merchant_key       INTEGER PRIMARY KEY,
    merchant_id        VARCHAR(32),
    merchant_category  VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS dim_country (
    country_key   INTEGER PRIMARY KEY,
    country       VARCHAR(8) NOT NULL,
    country_name  VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS fact_transaction (
    transaction_id  VARCHAR(40) NOT NULL,
    customer_key    INTEGER REFERENCES dim_customer(customer_key),
    merchant_key    INTEGER REFERENCES dim_merchant(merchant_key),
    time_key        INTEGER REFERENCES dim_time(time_key),
    country_key     INTEGER REFERENCES dim_country(country_key),
    amount          DECIMAL(18, 2),
    risk_score      DECIMAL(5, 3)
);
