function readSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured && process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }
  if (!configured) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  }
  const url = new URL(configured);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute http/https URL without credentials");
  }
  if (process.env.NODE_ENV === "production" && url.hostname === "localhost") {
    throw new Error("NEXT_PUBLIC_SITE_URL cannot use localhost in production");
  }
  return url.toString().replace(/\/$/, "");
}

export const SITE_CONFIG = {
  name: "All Jobs India",
  shortName: "AllJobsIndia",
  description:
    "Latest Government Jobs, Private Jobs, Results, Admit Cards, Answer Keys and Job Notifications in India.",
  url: readSiteUrl(),
  language: "en-IN",
  country: "IN",
};

export function absoluteUrl(path: string = "/") {
  const base = SITE_CONFIG.url.replace(/\/$/, "");
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${base}${clean}`;
}
