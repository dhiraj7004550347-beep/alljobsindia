import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, requestIp } from "@/lib/rate-limit";
import { sendAlertVerification } from "@/lib/automation/alert-delivery";
import { hashAlertToken, normalizeAlertEmail } from "@/lib/automation/alert-token";

const subscriptionSchema = z.object({
  email: z.string().email().max(320),
  keywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  categories: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  locations: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  qualification: z.string().trim().max(150).optional(),
}).strict();

const unsubscribeSchema = z.object({
  email: z.string().email().max(320),
  token: z.string().min(32).max(200),
}).strict();

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit({
    namespace: "job-alert-subscribe",
    identifier: requestIp(request),
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many subscription attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a valid email and preferences." }, { status: 400 });
  }

  const emailNormalized = normalizeAlertEmail(parsed.data.email);
  const verificationToken = randomBytes(32).toString("base64url");
  const unsubscribeToken = randomBytes(32).toString("base64url");
  const existing = await prisma.jobAlertSubscription.findUnique({
    where: { emailNormalized },
    select: { id: true },
  });
  if (existing) {
    await prisma.jobAlertSubscription.update({
      where: { id: existing.id },
      data: {
        email: parsed.data.email.trim(),
        keywords: parsed.data.keywords,
        categories: parsed.data.categories,
        locations: parsed.data.locations,
        qualification: parsed.data.qualification || null,
        active: true,
        verifiedAt: null,
        verificationToken: hashAlertToken(verificationToken),
        unsubscribeToken: hashAlertToken(unsubscribeToken),
      },
    });
  } else {
    await prisma.jobAlertSubscription.create({
      data: {
        email: parsed.data.email.trim(),
        emailNormalized,
        keywords: parsed.data.keywords,
        categories: parsed.data.categories,
        locations: parsed.data.locations,
        qualification: parsed.data.qualification || null,
        verificationToken: hashAlertToken(verificationToken),
        unsubscribeToken: hashAlertToken(unsubscribeToken),
      },
    });
  }

  const delivery = await sendAlertVerification({
    email: emailNormalized,
    verificationToken,
    unsubscribeToken,
  });

  return NextResponse.json({
    success: true,
    verificationRequired: true,
    verificationSent: delivery.delivered,
    unsubscribeToken,
    message: delivery.delivered
      ? "Alert saved. Check your email to verify this alert."
      : "Alert saved. Email verification is pending provider configuration.",
  }, { status: existing ? 200 : 201 });
}

export async function DELETE(request: NextRequest) {
  const rate = await checkRateLimit({
    namespace: "job-alert-unsubscribe",
    identifier: requestIp(request),
    limit: 10,
    windowMs: 60 * 60_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many unsubscribe attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  const parsed = unsubscribeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid email and unsubscribe token are required." }, { status: 400 });
  }
  const updated = await prisma.jobAlertSubscription.updateMany({
    where: {
      emailNormalized: normalizeAlertEmail(parsed.data.email),
      unsubscribeToken: hashAlertToken(parsed.data.token),
    },
    data: { active: false },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: "Job alerts disabled." });
}
