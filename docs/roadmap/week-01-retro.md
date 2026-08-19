# Week 1 retro

## What we shipped

- Archived the full pre-rebuild project on `old`, renamed the GitHub repo to `ragify`, orphan-reset `main` to application code.
- Branch protection on `main`, PR template, CODEOWNERS, commitlint/husky, CI (typecheck, Prettier, gitleaks) required to merge.
- Rate limits and quota **fail closed** (503 if Redis/quota cannot be evaluated).
- Boot-time zod env; no `dev-insecure-secret`; production Stripe/CRON required.
- Global Hono `onError` + request ids on logs.
- Plan bot limits enforced; dead crawl stub / unused imports / unused `@sentry/react` removed; Clerk email synced on login.
- README matches reality. ADR 0001 records AWS vs DO vs OCI and the NAT/ALB/EKS skip.

## What took longer than expected

- GitHub OAuth lacked `workflow` scope, so the first `ci.yml` push failed until a device-login refresh.
- A new workflow does not run on a PR until it exists on the default branch — so we had to merge CI before the deliberate fail PRs could prove the gates.
- Dependabot opened a 34-package major bump (Node 22 / `ai` v7) that broke typecheck. We reverted it, then it came back as several PRs. Version updates are now `open-pull-requests-limit: 0`.
- Vercel was still linked to the old Helply project and posted failing checks on every PR until disconnected in the dashboard.

## What we did not finish

- **DigitalOcean destroy** still needs a console/`doctl` pass if the droplet is running. `doctl` on this machine returns 401 (expired token). No data to rescue. Confirm billing is zero in the DO dashboard.

## What we learned about the codebase

- HTTP is thin (`apps/api/src/modules/*`); real logic lives in `@ragify/core`. API and worker share that package — it is baked into images at build time, not copied onto every VM.
- Fail-open `catch` around Redis was the scariest production footgun: unlimited chat if Redis died.
- `PLAN_LIMITS` was UI-only until today.
- Clerk upsert never received an email claim, so quota-alert mail would have gone nowhere.
