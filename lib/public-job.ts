import type { Prisma } from "@prisma/client";

/** Minimal public fields used by the paginated listing cards. */
export const publicJobCardSelect = {
  id: true,
  title: true,
  department: true,
  qualification: true,
  vacancy: true,
  location: true,
  category: true,
  lastDate: true,
  expiresAt: true,
  featured: true,
} satisfies Prisma.JobSelect;

/** Fields that are safe and useful on unauthenticated job APIs. */
export const publicJobSelect = {
  id: true,
  title: true,
  department: true,
  qualification: true,
  vacancy: true,
  salary: true,
  ageLimit: true,
  location: true,
  applicationFee: true,
  selectionProcess: true,
  description: true,
  howToApply: true,
  importantDates: true,
  applicationStartDate: true,
  lastDate: true,
  applyLink: true,
  notificationLink: true,
  officialWebsite: true,
  category: true,
  status: true,
  featured: true,
  sourceName: true,
  sourceUrl: true,
  postedDate: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JobSelect;
