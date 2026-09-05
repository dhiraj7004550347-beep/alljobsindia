import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

export const ADMIN_COOKIE = "alljobsindia_admin";
const JWT_ISSUER = "alljobsindia";
const JWT_AUDIENCE = "alljobsindia-admin";

function getSecret() {
  const value = process.env.ADMIN_SECRET;
  return value ? new TextEncoder().encode(value) : null;
}

export async function verifyAdminToken(
  token: string | null | undefined
): Promise<{ username: string } | null> {
  const secret = getSecret();

  if (!secret || !token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ["HS256"],
    });
    return payload.admin === true && typeof payload.username === "string"
      ? { username: payload.username }
      : null;
  } catch {
    return null;
  }
}

export async function isAdminRequest(
  request: NextRequest
): Promise<boolean> {
  return Boolean(await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value));
}

export async function isAdminSession(): Promise<boolean> {
  const store = await cookies();

  return Boolean(await verifyAdminToken(store.get(ADMIN_COOKIE)?.value));
}

export async function getAdminSession() {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export function adminJwtClaims(username: string) {
  return { admin: true, username, issuer: JWT_ISSUER, audience: JWT_AUDIENCE };
}

export function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
