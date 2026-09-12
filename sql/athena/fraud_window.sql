SELECT
    metric_date,
    fraud_events,
    avg_risk
FROM gold_fraud_summary
WHERE fraud_events > 0
ORDER BY metric_date DESC;
