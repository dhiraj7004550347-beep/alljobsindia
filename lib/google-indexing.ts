import "server-only";

import { importPKCS8, SignJWT } from "jose";
import { absoluteUrl } from "@/lib/site-config";

export type IndexingNotificationType = "URL_UPDATED" | "URL_DELETED";

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function config() {
  const clientEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  return clientEmail && privateKey ? { clientEmail, privateKey } : null;
}

async function accessToken(clientEmail: string, privateKey: string) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  if (tokenRequest) return tokenRequest;
  tokenRequest = createAccessToken(clientEmail, privateKey).finally(() => {
    tokenRequest = null;
  });
  return tokenRequest;
}

async function createAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1_000);
  const key = await importPKCS8(privateKey, "RS256");
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/indexing" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3_600)
    .sign(key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Google OAuth returned ${response.status}`);
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google OAuth response did not include an access token");
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + Math.max(300, body.expires_in || 3_600) * 1_000,
  };
  return body.access_token;
}

/** Best-effort and disabled unless real service-account credentials are configured. */
export async function notifyGoogleIndexing(
  path: string,
  type: IndexingNotificationType
) {
  const credentials = config();
  if (!credentials) return { configured: false, sent: false };
  try {
    const token = await accessToken(credentials.clientEmail, credentials.privateKey);
    const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: absoluteUrl(path), type }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Google Indexing API returned ${response.status}`);
    return { configured: true, sent: true };
  } catch (error) {
    console.error("Google indexing notification failed:", error instanceof Error ? error.message : "Unknown error");
    return { configured: true, sent: false };
  }
}
