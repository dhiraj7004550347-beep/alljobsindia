import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { isAdminRequest } from "../../../../lib/admin-auth";

function escapeCsv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const jobs = await prisma.job.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const headers = [
      "ID",
      "Job Title",
      "Department",
      "Qualification",
      "Vacancy",
      "Salary",
      "Age Limit",
      "Location",
      "Application Fee",
      "Selection Process",
      "Last Date",
      "Apply Link",
      "Notification Link",
      "Official Website",
      "Category",
      "Status",
      "Featured",
      "Created At",
      "Updated At",
    ];

    const rows = jobs.map((job) => [
      job.id,
      job.title,
      job.department,
      job.qualification,
      job.vacancy,
      job.salary,
      job.ageLimit,
      job.location,
      job.applicationFee,
      job.selectionProcess,
      job.lastDate?.toISOString().split("T")[0] || "",
      job.applyLink,
      job.notificationLink,
      job.officialWebsite,
      job.category,
      job.status,
      job.featured,
      job.createdAt.toISOString(),
      job.updatedAt.toISOString(),
    ]);

    const csv = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\r\n");

    return new NextResponse("\uFEFF" + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="alljobsindia-jobs.csv"',
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "CSV export failed",
      },
      { status: 500 }
    );
  }
}
