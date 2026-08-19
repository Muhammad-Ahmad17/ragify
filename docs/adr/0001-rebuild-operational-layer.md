# ADR 0001: Rebuild the operational layer

- **Status:** Accepted
- **Date:** 2026-08-19

## Context

Ragify is a working RAG SaaS (Vite SPA, Hono API, BullMQ worker, self-hosted embeddings). The product is down and has no users. The previous operational layer mixed DigitalOcean + OCI, lost Terraform state (`resources: []`), rebuilt images on the server instead of using what CI pushed, and inherited Dockerfiles that ran as root.

Job-market evidence for Lahore DevOps/cloud roles needs AWS, OIDC, Terraform remote state, Kubernetes, and observability — not a one-off droplet.

There was no production data worth migrating.

## Decision

Rebuild operations from empty directories instead of patching the old Terraform/compose/workflows. Keep application code. Archive the previous tree on branch `old`.

- **AWS** takes stateful and managed pieces (RDS Postgres 16 + pgvector, S3, ECR, EC2 running k3s).
- **Oracle Cloud always-free VMs** keep the two CPU-heavy workloads (embed + crawl worker).
- **DigitalOcean is dropped.**

Deliberately not used, with cost as the reason:

| Service           | Approx. monthly | Why not                                                                 |
| ----------------- | --------------- | ----------------------------------------------------------------------- |
| EKS control plane | ~$73            | k3s on one node teaches the same Kubernetes skills                      |
| NAT Gateway       | ~$32            | Public subnets + tight security groups; recorded as a security tradeoff |
| ALB               | ~$16            | k3s ingress-nginx + cert-manager on the node                            |

Steady-state AWS estimate ~$30/month (t4g.small + db.t4g.micro + S3/ECR/CloudWatch). A $5 budget alarm is the first AWS resource.

## Consequences

- Week 1–4 can break freely; production returns in week 5.
- One Terraform root will span AWS + OCI.
- Credits (~$200, 6 months on the Free plan) cover the learning window. After credits, production can move onto the OCI VMs (a real DR path).
- Lost DigitalOcean state is why week 3 puts Terraform state in S3 with DynamoDB locking.
