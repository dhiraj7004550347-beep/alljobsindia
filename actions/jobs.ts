"use server";

import { prisma } from "../lib/prisma";

export async function getJobs() {
  return await prisma.job.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createJob(data: {
  title: string;
  department: string;
  qualification: string;
  vacancy: string;
  salary: string;
  ageLimit: string;
  location: string;
  applicationFee: string;
  selectionProcess: string;
  lastDate: Date;
  applyLink: string;
  notificationLink: string;
  officialWebsite: string;
  category: string;
}) {
  await prisma.job.create({
    data,
  });

  return {
    success: true,
  };
}