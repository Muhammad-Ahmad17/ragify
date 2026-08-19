import { loadApiEnv } from "@ragify/core/env";
import { AppError } from "@ragify/core/errors";
import { logError } from "@ragify/core/log";
import { assertRateLimitConfigured } from "@ragify/core/rate-limit";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { ZodError } from "zod";
import { initSentry } from "./lib/sentry.js";
import { requireAuth, optionalAuth } from "./middleware/auth.js";
import { requestId } from "./middleware/request-id.js";
import {
  chatOptions,
  chatPost,
  botGet,
  crawlPost,
  stripeWebhookPost,
  checkoutPost,
  portalPost,
  adminStatsGet,
  healthCheckGet,
  exportConversationsGet,
  quotaAlertsGet,
  botsListGet,
  botsCreatePost,
  botsUpdatePatch,
  botsDelete,
  sourcesListGet,
  crawlJobsListGet,
  conversationsListGet,
  sourceTextPost,
  sourcePdfPost,
  sourceReindexPost,
} from "./routes.js";

initSentry("api");
loadApiEnv();
assertRateLimitConfigured();

const app = new Hono();

app.use("*", requestId);

app.onError((err, c) => {
  const id = c.get("requestId") ?? "unknown";
  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Invalid request",
        fields: err.flatten().fieldErrors,
        request_id: id,
      },
      400
    );
  }
  if (err instanceof AppError) {
    return c.json(
      { error: err.message, code: err.code, request_id: id },
      err.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500
    );
  }
  logError("unhandled_error", err);
  return c.json({ error: "Internal Server Error", request_id: id }, 500);
});

app.get("/health", (c) => c.json({ ok: true, service: "api" }));

app.options("/api/chat", chatOptions);
app.post("/api/chat", chatPost);

app.get("/api/bots", requireAuth, botsListGet);
app.post("/api/bots", requireAuth, botsCreatePost);
app.get("/api/bots/:botId", optionalAuth, botGet);
app.patch("/api/bots/:botId", requireAuth, botsUpdatePatch);
app.delete("/api/bots/:botId", requireAuth, botsDelete);
app.get("/api/bots/:botId/sources", requireAuth, sourcesListGet);
app.get("/api/bots/:botId/crawl-jobs", requireAuth, crawlJobsListGet);
app.get("/api/bots/:botId/conversations", requireAuth, conversationsListGet);

app.post("/api/crawl", requireAuth, crawlPost);
app.post("/api/sources/text", requireAuth, sourceTextPost);
app.post("/api/sources/pdf", requireAuth, sourcePdfPost);
app.post("/api/sources/reindex", requireAuth, sourceReindexPost);

app.post("/api/billing/checkout", requireAuth, checkoutPost);
app.post("/api/billing/portal", requireAuth, portalPost);
app.post("/api/webhooks/stripe", stripeWebhookPost);

app.get("/api/admin/stats", requireAuth, adminStatsGet);

app.get("/api/cron/health-check", healthCheckGet);
app.get("/api/cron/export-conversations", exportConversationsGet);
app.get("/api/cron/quota-alerts", quotaAlertsGet);

const port = Number(process.env.PORT ?? 3000);
console.log(`[api] Listening on :${port}`);
serve({ fetch: app.fetch, port });
