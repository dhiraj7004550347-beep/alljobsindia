import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_COOKIE, isSameOrigin } from "@/lib/admin-auth";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";

const loginSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(500),
});

function safeEqual(left: string, right: string) {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Invalid request origin" }, { status: 403 });
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Invalid login request" }, { status: 400 });
  }

  const rate = await checkRateLimit({
    namespace: "admin-login",
    identifier: `${requestIp(request)}|${parsed.data.username.toLowerCase()}`,
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, message: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const adminUsername = process.env.ADMIN_USERNAME || "";
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const adminSecret = process.env.ADMIN_SECRET || "";
  if (!adminUsername || !adminPassword || adminSecret.length < 32) {
    return NextResponse.json(
      { success: false, message: "Admin login is not safely configured" },
      { status: 503 }
    );
  }

  if (
    !safeEqual(parsed.data.username, adminUsername) ||
    !safeEqual(parsed.data.password, adminPassword)
  ) {
    return NextResponse.json(
      { success: false, message: "Invalid username or password" },
      { status: 401 }
    );
  }

  const token = await new SignJWT({ admin: true, username: adminUsername })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("alljobsindia")
    .setAudience("alljobsindia-admin")
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(new TextEncoder().encode(adminSecret));

  const response = NextResponse.json({ success: true });
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
