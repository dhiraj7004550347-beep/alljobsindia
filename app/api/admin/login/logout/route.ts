import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isSameOrigin } from "@/lib/admin-auth";

export async function POST(
  request: NextRequest
) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const response = NextResponse.redirect(
    new URL("/admin/login", request.url)
  );

  response.cookies.set(
    ADMIN_COOKIE,
    "",
    {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "lax",
      path: "/",
    }
  );

  return response;
}
