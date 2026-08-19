# Ragify

Paste a URL, get a chatbot trained on that content, embed it anywhere with one line.

**Vite SPA** · **Hono API** · **BullMQ worker** · **Self-hosted embeddings** · **Clerk** · **Stripe** · **Groq**

The product works. The operational layer is being rebuilt (see [docs/roadmap](docs/roadmap/README.md)): AWS replaces DigitalOcean, the always-free Oracle Cloud VMs stay, CI/CD and Terraform are written from scratch.

---

## Architecture (target)

| Component       | Role                                         |
| --------------- | -------------------------------------------- |
| `apps/web`      | React dashboard + embed widget               |
| `apps/api`      | Hono API (chat, crawl, billing, admin, cron) |
| `apps/embed`    | Self-hosted `bge-small-en-v1.5` (384-dim)    |
| `apps/worker`   | BullMQ crawl / embed / index worker          |
| `packages/core` | Shared crawler, chunking, db, queue          |
| `db/migrations` | Postgres + pgvector schema                   |

Auth: **Clerk**. Billing: **Stripe**. LLM: **Groq**. API errors can report to **Sentry** when `SENTRY_DSN` is set. There is no Datadog instrumentation.

---

## Local dev

```bash
npm install
cp .env.example .env.local   # fill DATABASE_URL, Clerk, Groq, Redis, RATE_LIMIT_SECRET

npm run typecheck
npm run format
npm run dev              # SPA
npm run dev:api          # API :3000
npm run dev:embed        # embeddings :8080
npm run dev:worker       # BullMQ worker
```

Set `EMBED_URL=http://localhost:8080` plus `DATABASE_URL` and `REDIS_URL`.

---

## CI

Every PR to `main` runs typecheck, Prettier, and gitleaks. Direct pushes to `main` are blocked.
