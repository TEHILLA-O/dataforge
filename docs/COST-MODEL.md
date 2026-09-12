# Cost model

DataForge is a portfolio environment. The first operational requirement is that it can be turned off.

## Profiles

| | `dev` | `stage` | `prod` |
| --- | --- | --- | --- |
| NAT | 0 | 1 | 1 |
| Kinesis | on-demand | on-demand | on-demand |
| Glue streaming job | not created | defined | defined |
| Redshift Serverless | off | off | 8 RPU, auto-pause 5 min |
| Athena | workgroup only | workgroup | workgroup |
| Budget | £20 | £45 | £80 |

Figures are orders of magnitude for `eu-west-2`, not quotes. NAT, Glue DPU-hours and Redshift RPU-hours dominate if you leave things running.

## Always-on tax (dev, idle)

| Item | Why it costs |
| --- | --- |
| Kinesis on-demand | near-zero with no puts |
| S3 / KMS / Glue catalog | cents |
| Lambda | per invoke |
| Athena | per TB scanned — partition projection keeps this small |
| CloudWatch | logs and the dashboard |

If the bill must be near-zero between demos: `dataforge destroy dev`. Isolated lake objects are *not* retained in `dev`.

## Tags

```
Project=DataForge
Environment=Dev | Stage | Prod
Owner=Portfolio
ManagedBy=CDK
CostCenter=Portfolio-DataForge
```

Cost Explorer and the monthly budget filter on `Project=DataForge`.

## How to keep a demo cheap

1. Work in `dev`. Use the local lake (`dataforge generate`) until you need a live stream.
2. Never start the Glue streaming job “to see the graph” and walk away.
3. Do not enable Redshift except for a timed `prod` walkthrough.
4. Destroy after the interview.
