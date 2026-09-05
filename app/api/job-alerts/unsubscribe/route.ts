import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashAlertToken, normalizeAlertEmail } from "@/lib/automation/alert-token";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = url.searchParams.get("email") || "";
  const token = url.searchParams.get("token") || "";
  if (!email || token.length < 20) {
    return NextResponse.json({ error: "The unsubscribe link is invalid." }, { status: 400 });
  }
  const result = await prisma.jobAlertSubscription.updateMany({
    where: {
      emailNormalized: normalizeAlertEmail(email),
      unsubscribeToken: hashAlertToken(token),
    },
    data: { active: false },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, message: "Job alerts disabled." }, {
    headers: { "cache-control": "no-store" },
  });
}
