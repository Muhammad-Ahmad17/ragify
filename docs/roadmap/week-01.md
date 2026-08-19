# Week 1 - Clear the ground, CI from an empty file

**Goal:** the DigitalOcean bill stops, the old operational layer is gone, `main` is protected, a CI pipeline you wrote yourself runs on every PR, and the three security defects that could bite in production are fixed.

**No cloud infrastructure this week.** AWS does not appear until week 3.

---

## Day 1 - Kill the DigitalOcean bill, archive everything

The droplet serves nobody, has no data worth keeping, and is charging you daily. Destroy it, then preserve the full pre-rebuild project on a branch before you wipe `main`.

### 1. Destroy the droplet

Check whether Terraform actually tracks it first - the audit found `terraform.tfstate` contains `"resources": []`, meaning state may have been lost:

```bash
cd infra/terraform
terraform state list
```

- **If resources are listed:** `terraform destroy` and confirm.
- **If the list is empty:** state is gone, so Terraform cannot destroy it. Delete the droplet, the firewall, and the DNS records from the DigitalOcean console (or with `doctl compute droplet delete <id>`). Note this in `docs/adr/` - lost state causing manual teardown is exactly why week 3 moves state to S3 with locking.

Then confirm in the DO billing page that nothing is still running. Keep the Spaces bucket only if it holds backups you want; otherwise delete it too. Leave the OCI VMs untouched.

### 2. Archive the full pre-rebuild state on `old`

Commit every in-flight change (including uncommitted Terraform edits) so nothing is lost:

```bash
git checkout -b old
git add -A
git commit -m "chore: archive full pre-rebuild state"
git push -u origin old
```

Confirm the branch and its file tree are visible on GitHub before continuing. This branch is your reference - you can read it any time; you just will not build on it.

### Acceptance criteria

- [ ] Droplet, firewall and DNS records deleted; DO billing shows no running resources
- [ ] OCI VMs untouched and still reachable
- [ ] Branch `old` pushed and contains the full pre-rebuild project (app + infra + deploy + workflows)

---

## Day 2 - Rename the repo, orphan-reset `main`

### 1. Fix the remote

The remote still points at the old project name:

```bash
git remote -v                                  # currently .../helply.git
gh repo rename ragify                          # or rename in GitHub settings
git remote set-url origin https://github.com/Muhammad-Ahmad17/ragify.git
```

### 2. Orphan-reset `main` to application code only

Do not surgically delete folders on the existing history. Start a clean history that contains only the product:

```bash
git checkout --orphan rebuild
git rm -r --cached infra deploy .github docs/CICD.md docs/DEPLOY.md \
  scripts/abuse-test.ts apps/api/Dockerfile apps/worker/Dockerfile apps/embed/Dockerfile
rm -rf infra deploy .github docs/CICD.md docs/DEPLOY.md scripts/abuse-test.ts \
  apps/api/Dockerfile apps/worker/Dockerfile apps/embed/Dockerfile
git commit -m "chore: initial commit - application code only

Operational layer is rebuilt from scratch across docs/roadmap.
Full previous project preserved on branch 'old'."
git branch -M rebuild main
git push --force origin main
```

What stays: `apps/`, `packages/`, `db/migrations/`, root package files, `docs/roadmap/`.
What is gone from `main` (rewritten later by you): `infra/`, `deploy/`, `.github/workflows/`, the old Dockerfiles, `docs/CICD.md`, `docs/DEPLOY.md`, and `scripts/abuse-test.ts`.

Terraform lock-file policy (`.terraform.lock.hcl` in version control) is decided when you write Terraform from scratch in week 3 - there is no terraform tree on `main` anymore.

Verify:

```bash
git log --oneline          # exactly one commit
npm run typecheck          # still passes - only operational code was removed
```

This is your last direct push to `main`. Branch protection lands tomorrow. Push `old` and confirm it on GitHub **before** the force-push to `main`.

### Acceptance criteria

- [ ] Remote and repo renamed to `ragify`
- [ ] `main` has a single root commit of application code only
- [ ] `infra/`, `deploy/`, `.github/` gone from `main`; still recoverable on `old`
- [ ] `npm run typecheck` still passes

---

## Day 3 - Make the git workflow professional

### 1. Branch protection

```bash
gh api -X PUT repos/Muhammad-Ahmad17/ragify/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": [] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 1 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

Add the CI check name to `contexts` on Day 4 once the workflow exists.

Working solo, the one-approval rule needs a real reviewer. Ask one classmate to swap reviews with you - genuine review history is worth more in interviews than a self-approved log. If that fails, drop `required_approving_review_count` to 0 but keep required status checks, and still write review comments on your own diffs before merging.

### 2. Repository scaffolding

- `.github/pull_request_template.md` - what changed, why, how it was tested, rollback plan
- `.github/CODEOWNERS` - `* @Muhammad-Ahmad17`
- `.github/dependabot.yml` - weekly `npm` updates grouped, plus `github-actions`
- `commitlint` with `@commitlint/config-conventional` and a `husky` `commit-msg` hook

### 3. Prove the gates work

Open a trivial PR (fix a typo), confirm you cannot merge without the checks, then merge it through the UI.

### Acceptance criteria

- [ ] Direct push to `main` is rejected
- [ ] PR template appears automatically on new PRs
- [ ] A non-conventional commit message is rejected locally by husky
- [ ] Dependabot has opened at least one PR (or is visibly scheduled)

---

## Day 4 - Write CI from an empty file

Create `.github/workflows/ci.yml` yourself. Do not copy the archived one. Requirements:

- Triggers on `pull_request` targeting `main`, plus `push` to `main`
- `concurrency` group keyed on the ref, cancelling superseded runs
- Node 20 with npm cache enabled
- Jobs: `npm ci`, `npm run typecheck`, format check, and a **gitleaks** scan
- Fail the build on any of them

Add a `format` script if the repo has no formatter configured yet (`prettier --check .` with a `.prettierignore` covering `dist`, `node_modules`, `*.tfstate*`).

### Verify it actually catches things

CI that has never failed is unverified. Prove each gate:

1. Push a branch with a deliberate type error - typecheck must fail
2. Push a branch with a fake AWS key in a comment - gitleaks must fail
3. Push a badly formatted file - format check must fail

Remove all three, get green, merge.

Then add the check name to branch protection:

```bash
gh api -X PATCH repos/Muhammad-Ahmad17/ragify/branches/main/protection/required_status_checks \
  -f 'contexts[]=ci'
```

### Acceptance criteria

- [ ] `.github/workflows/ci.yml` written from scratch, green on `main`
- [ ] All three deliberate failures observed and fixed
- [ ] CI is a required status check on `main`
- [ ] Total run time under 3 minutes

---

## Day 5 - Fail closed, not open

Three real defects. Each gets its own PR so the history reads clearly.

### 1. Rate limiting and quota must fail closed

In `apps/api/src/modules/chat/routes.ts` (around lines 177-201) the rate limit and quota checks are wrapped so that an error is caught and the request proceeds. If Redis is unavailable, every limit silently disappears - unlimited chat, unlimited spend on Groq tokens.

Change it so a failure to _evaluate_ a limit returns `503` rather than allowing the request. Add a log line at error level so the alert you build in week 7 has something to fire on.

Also handle the related case in `packages/core/src/rate-limit.ts`: when Redis is missing entirely, the limiter currently returns success. In production that must be a startup failure, not a warning.

### 2. No insecure secret defaults

`packages/core/src/security.ts` falls back to `"dev-insecure-secret"` for `RATE_LIMIT_SECRET`, which signs visitor IDs. A predictable secret means forgeable visitor identity and bypassable per-visitor limits.

Introduce a single zod-validated env module that runs at boot, requires every production secret, and exits non-zero with a clear message listing what is missing. Wire the API, worker and embed service through it. This also fixes the Stripe variables only being checked lazily when a billing route is hit.

### 3. Global error handler

The Hono app has no `onError`, so `.parse()` throws in the bots routes surface as 500s instead of 400s. Add one that maps zod errors to `400` with field details, known app errors to their status, and everything else to `500` with the error logged and a request id returned.

While you are there, add a request id to every log line - week 7's log aggregation is far more useful with correlation.

### Acceptance criteria

- [ ] Stopping Redis locally makes chat return `503`, not unlimited success
- [ ] Unsetting `RATE_LIMIT_SECRET` makes the API refuse to boot
- [ ] Malformed bot-create body returns `400` with field errors, not `500`
- [ ] Every log line carries a request id
- [ ] Three separate PRs, each with a description explaining the risk it closed

---

## Day 6 - Remove the lies and the dead code

Portfolio credibility depends on the repo not claiming things it does not do.

### 1. Enforce what the UI advertises

`PLAN_LIMITS.bots` (1 free / 3 starter / 10 pro) is defined in `types.ts` and displayed in the dashboard but **never enforced** on create. Enforce it server-side in the bots create handler, returning `403` with a clear code.

### 2. Delete dead code

- `processUrlBatch` is imported in the crawl routes and never called
- `@sentry/react` is a dependency in `apps/web/package.json` with no usage anywhere in `apps/web/src`
- `scripts/abuse-test.ts` tests `/api/auth/login-check`, an endpoint that does not exist
- `loginLimiter` is defined in `rate-limit.ts` and wired to nothing
- `/api/cron/crawl-worker` is a stub that returns a message saying BullMQ handles crawls

Either wire each one up or delete it. Prefer deleting.

### 3. Fix the Clerk email sync

In `packages/core/src/auth.ts` the user upsert only sets `email` on insert, from a parameter never passed - so `users.email` stays empty and the quota-alert emails you build in week 6 would go nowhere. Read the email claim from the verified JWT and keep it updated on every login.

### 4. Correct the README

It currently claims "Sentry + Datadog". Backend Sentry is real; Datadog is an opt-in compose profile with no APM instrumentation, and the web Sentry dependency is unused. Say what is actually true. Also strip the leftover `Helply` references in `chat-ui.tsx` and `widget.js`.

### 5. First ADR

Write `docs/adr/0001-rebuild-operational-layer.md`: the state you inherited, why the operational layer is being rebuilt rather than patched, why AWS replaces DigitalOcean while OCI stays, and what you are deliberately not using (EKS, NAT Gateway, ALB) with the cost figures.

### Acceptance criteria

- [ ] Free-plan user cannot create a second bot
- [ ] No dead imports, unused dependencies or stub endpoints remain
- [ ] `users.email` populates on login
- [ ] README describes only what exists
- [ ] `docs/adr/0001-*.md` committed

---

## Day 7 - Review, retro, write it up

1. Re-read every PR you opened this week. Would a reviewer understand each one from the description alone?
2. Confirm the full acceptance list below.
3. Write `docs/roadmap/week-01-retro.md`: what took longer than expected, what you did not finish, what you learned about the codebase.
4. Publish blog post #1 on `aahmad.app`: "Rebuilding my SaaS infrastructure from scratch, part 1: what I found when I audited my own project." Lead with the fail-open rate limiter and the hardcoded fallback secret - concrete security findings in your own code make a far better post than a tutorial, and they show judgment.
5. Rest the remaining hours.

---

## Week 1 acceptance criteria

- [ ] DigitalOcean fully destroyed, billing at zero — leftover: `doctl` auth is 401; destroy from the console if anything is still running
- [x] Full pre-rebuild project archived on branch `old` and pushed to GitHub
- [x] `main` orphan-reset to a single commit of application code only; remote renamed to `ragify`
- [x] `main` protected, PRs required, CI a required check
- [x] `ci.yml` written from scratch with typecheck, format and gitleaks, each gate verified by a deliberate failure
- [x] Rate limiting and quota fail closed; app refuses to boot without required secrets
- [x] Global error handler with request ids
- [x] Plan bot limits enforced; dead code and stub endpoints removed
- [x] `docs/adr/0001-*.md` and week 1 retro committed
- [x] Blog post #1 published: https://aahmad.app/blog/rebuilding-saas-infrastructure-part-1

**Next:** `week-02.md` - tests against ephemeral Postgres and Redis, hardened multi-stage containers, Trivy in CI.
