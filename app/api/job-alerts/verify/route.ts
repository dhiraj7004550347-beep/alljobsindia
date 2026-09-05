import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashAlertToken, normalizeAlertEmail } from "@/lib/automation/alert-token";

function html(message: string, status = 200) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>AllJobsIndia alerts</title></head><body><main><h1>AllJobsIndia job alerts</h1><p>${message}</p><p>You can close this window.</p></main></body></html>`,
    {
      status,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("token") || "";
  if (!email || token.length < 20) return html("The verification link is invalid.", 400);

  const subscription = await prisma.jobAlertSubscription.findFirst({
    where: { emailNormalized: normalizeAlertEmail(email), verificationToken: hashAlertToken(token) },
    select: { id: true, verifiedAt: true },
  });
  if (!subscription) return html("The verification link is invalid or has expired.", 404);

  if (!subscription.verifiedAt) {
    await prisma.jobAlertSubscription.update({
      where: { id: subscription.id },
      data: { verifiedAt: new Date() },
    });
  }
  return html("Your job alert is verified. New matching jobs can now be delivered.");
}
