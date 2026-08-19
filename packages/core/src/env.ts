import { z } from "zod";

function missingMessage(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "env";
      return `  - ${path}: ${issue.message}`;
    })
    .join("\n");
}

function parseOrExit<T>(
  schema: z.ZodType<T>,
  label: string,
  data: NodeJS.ProcessEnv
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(
      `[${label}] Invalid environment:\n${missingMessage(result.error.issues)}`
    );
    process.exit(1);
  }
  return result.data;
}

const redisShape = z
  .object({
    REDIS_URL: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.string().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    DISABLE_RATE_LIMIT: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.DISABLE_RATE_LIMIT === "true") return;
    const hasRedis = Boolean(env.REDIS_URL);
    const hasUpstash = Boolean(
      env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    );
    if (!hasRedis && !hasUpstash) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN is required",
      });
    }
  });

const apiEnvSchema = z
  .object({
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    EMBED_URL: z.string().min(1),
    RATE_LIMIT_SECRET: z.string().min(16),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_STARTER_PRICE_ID: z.string().optional(),
    STRIPE_PRO_PRICE_ID: z.string().optional(),
    CRON_SECRET: z.string().optional(),
  })
  .and(redisShape)
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    const required = [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_STARTER_PRICE_ID",
      "STRIPE_PRO_PRICE_ID",
      "CRON_SECRET",
    ] as const;
    for (const key of required) {
      if (!env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Required in production",
        });
      }
    }
  });

const embedEnvSchema = z.object({
  EMBED_PORT: z.string().optional(),
  EMBED_MODEL: z.string().optional(),
  EMBED_API_KEY: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type EmbedEnv = z.infer<typeof embedEnvSchema>;

export function loadApiEnv(): ApiEnv {
  return parseOrExit(apiEnvSchema, "api", process.env);
}

export function loadWorkerEnv() {
  return parseOrExit(
    z.object({
      DATABASE_URL: z.string().min(1),
      EMBED_URL: z.string().min(1),
      REDIS_URL: z.string().min(1),
    }),
    "worker",
    process.env
  );
}

export function loadEmbedEnv(): EmbedEnv {
  return parseOrExit(embedEnvSchema, "embed", process.env);
}
