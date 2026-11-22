# Cost estimate (estimate, not a bill; confirm in Cost Explorer)

Region ap-southeast-2. Stack timeline (UTC, 2026-11-22): first apply 13:36:48, app deployed/stable 13:53:29,
destroy 14:00:45 to 14:07:49. Billable window of the main resources: roughly 13:40 to 14:07, about 0.5 hour.

| Item | Approx. rate | x 0.5 h |
|---|---|---|
| ALB | ~USD 0.03/h | 0.015 |
| Public IPv4 (2 ALB + 1 Fargate) | 3 x 0.005/h | 0.008 |
| Fargate 0.5 vCPU / 1 GB | ~USD 0.03/h | 0.015 |
| RDS db.t4g.micro + 20 GB gp3 | ~USD 0.03/h | 0.015 |
| ECR, SSM, logs, data transfer | negligible | <0.01 |

Total: roughly USD 0.05 to 0.10. No NAT gateway, no Secrets Manager, no CloudFront (account not verified).
