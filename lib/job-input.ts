import type { JobStatus } from "@prisma/client";
import { z } from "zod";
import { parseSupportedDate } from "./automation/normalizer";

export type JobWriteData = {
  title: string;
  department: string | null;
  qualification: string | null;
  vacancy: string | null;
  salary: string | null;
  ageLimit: string | null;
  location: string | null;
  applicationFee: string | null;
  selectionProcess: string | null;
  description: string | null;
  howToApply: string | null;
  applicationStartDate: Date | null;
  lastDate: Date | null;
  applyLink: string | null;
  notificationLink: string | null;
  officialWebsite: string | null;
  category: string;
  status: JobStatus;
  featured: boolean;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function nullable(value: unknown) {
  const result = text(value);
  return result || null;
}

function validHttpUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function parseJobWriteData(
  value: unknown,
  options?: {
    forceStatus?: JobStatus;
  }
):
  | { ok: true; data: JobWriteData }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid job payload." };
  }
  const body = value as Record<string, unknown>;
  const title = text(body.title);
  const category = text(body.category);
  if (!title || !category || title.length > 300 || category.length > 100) {
    return {
      ok: false,
      error: "A title and category are required and must be reasonably sized.",
    };
  }

  const limits: Record<string, number> = {
    department: 300,
    qualification: 4_000,
    vacancy: 300,
    salary: 1_000,
    ageLimit: 1_000,
    location: 500,
    applicationFee: 1_000,
    selectionProcess: 4_000,
    description: 10_000,
    howToApply: 5_000,
    applyLink: 2_000,
    notificationLink: 2_000,
    officialWebsite: 2_000,
  };
  for (const [field, max] of Object.entries(limits)) {
    if (text(body[field]).length > max) {
      return { ok: false, error: `${field} is too long.` };
    }
  }

  const parseDate = (value: unknown, label: string) => {
    const raw = text(value);
    if (!raw) return { value: null };
    const date = parseSupportedDate(raw);
    return !date
      ? { error: `${label} is invalid.` }
      : { value: date };
  };
  const deadline = parseDate(body.lastDate, "Last date");
  const startDate = parseDate(body.applicationStartDate, "Application start date");
  if (deadline.error || startDate.error) {
    return { ok: false, error: deadline.error || startDate.error || "Invalid date." };
  }
  if (deadline.value && startDate.value && startDate.value > deadline.value) {
    return { ok: false, error: "Application start date must not be after the last date." };
  }

  const applyLink = text(body.applyLink);
  const notificationLink = text(body.notificationLink);
  const officialWebsite = text(body.officialWebsite);

  for (const [label, value] of [
    ["Apply link", applyLink],
    ["Notification link", notificationLink],
    ["Official website", officialWebsite],
  ] as const) {
    if (!validHttpUrl(value)) {
      return {
        ok: false,
        error: `${label} must be a valid http/https URL.`,
      };
    }
  }

  const statusResult = z
    .enum(["DRAFT", "PUBLISHED", "EXPIRED", "ARCHIVED"])
    .safeParse(body.status);
  const status: JobStatus = options?.forceStatus ??
    (statusResult.success ? statusResult.data : "DRAFT");
  if (status === "PUBLISHED" && deadline.value && deadline.value < new Date()) {
    return { ok: false, error: "A past-deadline job cannot be published. Mark it expired or archived." };
  }

  return {
    ok: true,
    data: {
      title,
      department: nullable(body.department),
      qualification: nullable(body.qualification),
      vacancy: nullable(body.vacancy),
      salary: nullable(body.salary),
      ageLimit: nullable(body.ageLimit),
      location: nullable(body.location),
      applicationFee: nullable(body.applicationFee),
      selectionProcess: nullable(body.selectionProcess),
      description: nullable(body.description),
      howToApply: nullable(body.howToApply),
      applicationStartDate: startDate.value ?? null,
      lastDate: deadline.value ?? null,
      applyLink: applyLink || null,
      notificationLink: notificationLink || null,
      officialWebsite: officialWebsite || null,
      category,
      status,
      featured: body.featured === true,
    },
  };
}
