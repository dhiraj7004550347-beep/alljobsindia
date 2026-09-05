import { createHash } from "node:crypto";

export function normalizeAlertEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function hashAlertToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
