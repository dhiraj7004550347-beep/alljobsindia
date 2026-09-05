import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function hashKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function checkRateLimit(input: {
  namespace: string;
  identifier: string;
  limit: number;
  windowMs: number;
}) {
  const key = `${input.namespace}:${hashKey(input.identifier)}`;
  const now = new Date();
  const nextExpiresAt = new Date(now.getTime() + input.windowMs);
  const cappedCount = input.limit + 1;

  // One atomic PostgreSQL statement avoids holding an interactive transaction
  // while a pooled/cloud database connection is waking up. The conflicting row
  // is still locked by PostgreSQL, so concurrent attempts cannot bypass the limit.
  const [bucket] = await prisma.$queryRaw<Array<{ count: number; expiresAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStartedAt", "expiresAt")
    VALUES (${key}, 1, ${now}, ${nextExpiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1
        ELSE LEAST("RateLimitBucket"."count" + 1, ${cappedCount})
      END,
      "windowStartedAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now}
        ELSE "RateLimitBucket"."windowStartedAt"
      END,
      "expiresAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${nextExpiresAt}
        ELSE "RateLimitBucket"."expiresAt"
      END
    RETURNING "count", "expiresAt"
  `;

  if (!bucket) {
    throw new Error("Rate-limit bucket update returned no row");
  }

  const allowed = bucket.count <= input.limit;
  return {
    allowed,
    remaining: allowed ? Math.max(0, input.limit - bucket.count) : 0,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1_000)),
  };
}
