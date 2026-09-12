# Governance

Lake Formation is the access plane. IAM roles exist so a human or a notebook can assume a persona; LF decides which databases, tables and columns they can see.

## Personas

| Persona | RAW | BRONZE | SILVER | GOLD |
| --- | --- | --- | --- | --- |
| DataEngineer | R/W | R/W | R/W | R |
| DataAnalyst | denied | denied | R (masked) | R |
| FinanceAnalyst | denied | denied | limited | country, amount, volume, currency only |
| SecurityAnalyst | quarantine R | — | — | fraud_summary |
| Administrator | R/W | R/W | R/W | R/W unmasked |
| Auditor | denied | denied | denied | R |

FinanceAnalyst is the interview example: they can sum revenue and still cannot select `email` or `ip_address`. That grant is a Lake Formation `TableWithColumns` permission in `governance-stack.ts`.

Default IAM/LF database permissions are cleared (`createDatabaseDefaultPermissions: []`) so access is explicit, not inherited from `IAMAllowedPrincipals`.
