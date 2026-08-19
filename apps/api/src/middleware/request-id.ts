import { randomUUID } from "node:crypto";
import type { Context, Next } from "hono";
import { runWithRequestId } from "@ragify/core/log";

export async function requestId(c: Context, next: Next) {
  const id = c.req.header("x-request-id") ?? randomUUID();
  c.set("requestId", id);
  c.header("X-Request-Id", id);
  await runWithRequestId(id, () => next());
}
