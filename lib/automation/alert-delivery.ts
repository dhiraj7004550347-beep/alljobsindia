import "server-only";

type AlertVerificationInput = {
  email: string;
  verificationToken: string;
  unsubscribeToken: string;
};

export type AlertDeliveryResult = {
  configured: boolean;
  delivered: boolean;
  reason: string;
};

function validUrl(raw: string | undefined, requireHttps: boolean): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (requireHttps && url.protocol !== "https:" && !local) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function publicSiteUrl(): URL | null {
  return validUrl(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL,
    process.env.NODE_ENV === "production",
  );
}

/** Provider-neutral verification event; a mail service renders the links. */
export async function sendAlertVerification(
  input: AlertVerificationInput,
): Promise<AlertDeliveryResult> {
  const webhook = validUrl(
    process.env.ALERT_EMAIL_WEBHOOK_URL,
    process.env.NODE_ENV === "production",
  );
  if (!webhook) {
    return { configured: false, delivered: false, reason: "No valid alert email webhook is configured." };
  }

  const site = publicSiteUrl();
  if (!site) {
    return { configured: true, delivered: false, reason: "NEXT_PUBLIC_SITE_URL must be a valid public URL." };
  }

  const verificationUrl = new URL("/api/job-alerts/verify", site);
  verificationUrl.searchParams.set("email", input.email);
  verificationUrl.searchParams.set("token", input.verificationToken);
  const unsubscribeUrl = new URL("/api/job-alerts/unsubscribe", site);
  unsubscribeUrl.searchParams.set("email", input.email);
  unsubscribeUrl.searchParams.set("token", input.unsubscribeToken);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        event: "job_alert_verification",
        to: input.email,
        from: process.env.ALERT_EMAIL_FROM || undefined,
        subject: "Verify your AllJobsIndia job alert",
        verificationUrl: verificationUrl.toString(),
        unsubscribeUrl: unsubscribeUrl.toString(),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      return { configured: true, delivered: false, reason: "Alert email provider rejected the verification request." };
    }
    return { configured: true, delivered: true, reason: "Verification request accepted by the alert email provider." };
  } catch {
    return { configured: true, delivered: false, reason: "Alert email provider could not be reached." };
  } finally {
    clearTimeout(timer);
  }
}
