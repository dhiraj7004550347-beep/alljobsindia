import type { NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { isAdminRequest } from "@/lib/admin-auth";

function secretMatches(provided: string | null | undefined, configured: string) {
  if (!provided) return false;
  const left = createHash("sha256").update(provided).digest();
  const right = createHash("sha256").update(configured).digest();
  return timingSafeEqual(left, right);
}

export async function isAutomationAuthorized(
  request: NextRequest
) {
  if (await isAdminRequest(request)) {
    return "admin" as const;
  }

  const configured =
    process.env.AUTOMATION_SECRET;

  if (!configured) {
    return null;
  }

  return secretMatches(request.headers.get("x-automation-secret"), configured)
    ? ("secret" as const)
    : null;
}

export function isCronAuthorized(
  request: NextRequest
) {
  // Vercel Cron sends the standard CRON_SECRET bearer token. Local and
  // non-Vercel schedulers continue to use AUTOMATION_CRON_SECRET.
  const configured =
    process.env.CRON_SECRET || process.env.AUTOMATION_CRON_SECRET;

  if (!configured) {
    return false;
  }

  const bearer =
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();

  const header =
    request.headers.get(
      "x-cron-secret"
    );

  return (
    secretMatches(bearer, configured) ||
    secretMatches(header, configured)
  );
}
