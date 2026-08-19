import { AsyncLocalStorage } from "node:async_hooks";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  msg: string;
  level?: LogLevel;
  bot_id?: string;
  user_id?: string;
  request_id?: string;
  latency_ms?: number;
  plan?: string;
  error?: string;
  [key: string]: unknown;
}

const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return requestContext.run({ requestId }, fn);
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}

let sentryReady = false;

function initSentry() {
  if (sentryReady) return;
  sentryReady = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/node") as {
      init: (opts: { dsn: string; environment?: string }) => void;
    };
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? "production",
    });
  } catch {
    // @sentry/node not installed in this image
  }
}

export function log(fields: LogFields) {
  initSentry();
  const { level = "info", msg, request_id: explicitId, ...rest } = fields;
  const request_id = explicitId ?? getRequestId();
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(request_id ? { request_id } : {}),
    ...rest,
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function captureSentry(err: unknown, extra: Record<string, unknown>) {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    initSentry();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/node") as {
      captureException: (
        err: Error,
        opts?: { extra?: Record<string, unknown> }
      ) => void;
    };
    Sentry.captureException(
      err instanceof Error ? err : new Error(String(err)),
      {
        extra,
      }
    );
  } catch {
    // Sentry optional
  }
}

export function logError(
  msg: string,
  err: unknown,
  extra?: Record<string, unknown>
) {
  log({
    level: "error",
    msg,
    error: err instanceof Error ? err.message : String(err),
    ...extra,
  });

  captureSentry(err, { msg, ...extra });
}
