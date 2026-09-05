import type { Prisma } from "@prisma/client";

export const PUBLIC_JOBS_PAGE_SIZE = 12;

export type PublicJobFilters = {
  query: string;
  category: string;
  location: string;
  closingSoon: boolean;
  page: number;
};

type SearchParamValue = string | string[] | undefined;

function first(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function boundedText(value: SearchParamValue, max: number) {
  return first(value).trim().slice(0, max);
}

export function parsePublicJobFilters(
  searchParams: Record<string, SearchParamValue>
): PublicJobFilters {
  const rawPage = Number(first(searchParams.page));
  return {
    query: boundedText(searchParams.q, 120),
    category: boundedText(searchParams.category, 100),
    location: boundedText(searchParams.location, 200),
    closingSoon: first(searchParams.closing) === "soon",
    page: Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10_000) : 1,
  };
}

export function activePublishedJobsWhere(now: Date): Prisma.JobWhereInput {
  return {
    status: "PUBLISHED",
    OR: [
      { lastDate: null, expiresAt: null },
      { lastDate: { gte: now } },
      { expiresAt: { gte: now } },
    ],
  };
}

export function buildPublicJobsWhere(
  filters: PublicJobFilters,
  now: Date
): Prisma.JobWhereInput {
  const and: Prisma.JobWhereInput[] = [activePublishedJobsWhere(now)];

  if (filters.query) {
    and.push({
      OR: [
        { title: { contains: filters.query, mode: "insensitive" } },
        { department: { contains: filters.query, mode: "insensitive" } },
        { qualification: { contains: filters.query, mode: "insensitive" } },
        { category: { contains: filters.query, mode: "insensitive" } },
        { location: { contains: filters.query, mode: "insensitive" } },
      ],
    });
  }

  if (filters.category) and.push({ category: filters.category });
  if (filters.location) and.push({ location: filters.location });

  if (filters.closingSoon) {
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
    and.push({
      OR: [
        { lastDate: { gte: now, lte: end } },
        { lastDate: null, expiresAt: { gte: now, lte: end } },
      ],
    });
  }

  return { AND: and };
}

export function publicJobsPageCount(total: number) {
  return Math.max(1, Math.ceil(Math.max(0, total) / PUBLIC_JOBS_PAGE_SIZE));
}
