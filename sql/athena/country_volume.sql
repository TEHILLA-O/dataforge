SELECT
    country,
    COUNT(*) AS transactions,
    SUM(volume) AS volume
FROM gold_country_performance
GROUP BY country
ORDER BY volume DESC;
