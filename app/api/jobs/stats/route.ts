import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isAdminRequest } from "@/lib/admin-auth"

export async function GET(request: NextRequest) {
  try {
    const admin = await isAdminRequest(request)
    const now = new Date()
    const jobs = await prisma.job.findMany({
      where: admin
        ? undefined
        : {
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
    })

    const total = jobs.length

    const government = jobs.filter(
      (job) =>
        job.category.toLowerCase().includes("government")
    ).length

    const privateJobs = jobs.filter(
      (job) =>
        job.category.toLowerCase().includes("private")
    ).length

    const active = jobs.filter(
      (job) =>
        job.status === "PUBLISHED" &&
        (!job.lastDate || job.lastDate >= now)
    ).length

    const expired = jobs.filter(
      (job) =>
        (job.status === "EXPIRED" || Boolean(job.lastDate && job.lastDate < now))
    ).length

    const closingSoon = jobs.filter((job) => {
      if (!job.lastDate) return false
      const diff = job.lastDate.getTime() - now.getTime()

      const days =
        diff / (1000 * 60 * 60 * 24)

      return (
        job.status === "PUBLISHED" &&
        days >= 0 &&
        days <= 7
      )
    }).length

    const featured = jobs.filter(
      (job) => job.featured
    ).length

    return NextResponse.json({
      total,
      government,
      private: privateJobs,
      active,
      closingSoon,
      expired,
      featured,
    })
  } catch (error) {
    console.error("Job statistics API error:", error)

    return NextResponse.json(
      {
        error: "Failed to load job statistics",
      },
      {
        status: 500,
      }
    )
  }
}
