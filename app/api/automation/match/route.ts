import { NextRequest, NextResponse } from "next/server";
import {
  jobMatchesAlert,
  type AlertJob,
  type JobAlertPreference,
} from "@/lib/automation/alerts";
import { isAdminRequest, isSameOrigin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest
) {
  if (!(await isAdminRequest(request)) || !isSameOrigin(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();

    const jobs: AlertJob[] =
      Array.isArray(body.jobs)
        ? body.jobs.slice(0, 1_000)
        : [];

    const preferences: JobAlertPreference[] =
      Array.isArray(body.preferences)
        ? body.preferences.slice(0, 1_000)
        : [];

    const matches =
      preferences.map(
        (preference) => ({
          preferenceId:
            preference.id,

          jobs:
            jobs.filter(
              (job) =>
                jobMatchesAlert(
                  job,
                  preference
                )
            ),
        })
      );

    return NextResponse.json({
      success: true,
      matches,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Matching failed",
      },
      { status: 500 }
    );
  }
}
