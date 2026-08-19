# Rebuilding my SaaS infrastructure from scratch, part 1

Published: https://aahmad.app/blog/rebuilding-saas-infrastructure-part-1

---

Ragify is a small RAG product: paste a URL, get a chatbot, embed it with one script tag. The app worked. The operations around it did not. This week I archived the old DigitalOcean deploy, reset `main` to application code, and put a CI gate on every PR. I also audited my own API.

Two findings were enough to justify the rebuild on their own.

**Fail-open rate limits.** Chat wrapped Redis in `try/catch` and continued on error. If Redis was down, every visitor got unlimited chat — and I paid Groq for it. Quota checks did the same. Those paths now return 503 and log at error level. Missing Redis at boot is a process exit, not a warning.

**A hardcoded HMAC secret.** `RATE_LIMIT_SECRET` fell back to `"dev-insecure-secret"`. Visitor IDs are signed with that secret. A known default means forgeable visitors and bypassable per-visitor limits. The API now refuses to start without a real secret (zod at boot, same module for worker and embed).

Neither bug needed a new cloud. They needed honesty about what the code did when a dependency failed. Week 2 is tests and containers. Week 3 is Terraform on AWS. The product stays down until week 5 on purpose: that is when the learning stops being free.
