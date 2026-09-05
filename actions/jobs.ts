"use server";

import { prisma } from "../lib/prisma";
import { requireAdminSession } from "../lib/admin-auth";
import { publicJobCardSelect } from "../lib/public-job";
import {
  activePublishedJobsWhere,
  buildPublicJobsWhere,
  PUBLIC_JOBS_PAGE_SIZE,
  publicJobsPageCount,
  type PublicJobFilters,
} from "../lib/public-jobs-query";

export async function getJobs() {
  const now = new Date();
  return prisma.job.findMany({
    where: {
      status: "PUBLISHED",
      OR: [
        { lastDate: null, expiresAt: null },
        { lastDate: { gte: now } },
        { expiresAt: { gte: now } },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getPublicJobsPage(filters: PublicJobFilters) {
  const now = new Date();
  const where = buildPublicJobsWhere(filters, now);
  const total = await prisma.job.count({ where });
  const pageCount = publicJobsPageCount(total);
  const page = Math.min(filters.page, pageCount);
  const activeWhere = activePublishedJobsWhere(now);

  const [jobs, categoryRows, locationRows] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PUBLIC_JOBS_PAGE_SIZE,
      take: PUBLIC_JOBS_PAGE_SIZE,
      select: publicJobCardSelect,
    }),
    prisma.job.findMany({
      where: activeWhere,
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    prisma.job.findMany({
      where: { AND: [activeWhere, { location: { not: null } }] },
      select: { location: true },
      distinct: ["location"],
      orderBy: { location: "asc" },
    }),
  ]);

  return {
    jobs,
    total,
    page,
    pageCount,
    categories: categoryRows.map((item) => item.category).filter(Boolean),
    locations: locationRows
      .map((item) => item.location?.trim())
      .filter((value): value is string => Boolean(value)),
  };
}

export async function getAllJobs() {
  await requireAdminSession();

  return prisma.job.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getJobById(id: number) {
  await requireAdminSession();

  return prisma.job.findUnique({
    where: {
      id,
    },
  });
}
