import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_COOKIE } from "./lib/admin-auth";

export async function proxy(
  request: NextRequest
) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/api/admin/login")
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    const token =
      request.cookies.get(
        ADMIN_COOKIE
      )?.value;

    if (!token || !process.env.ADMIN_SECRET) {
      return NextResponse.redirect(
        new URL(
          "/admin/login",
          request.url
        )
      );
    }

    try {
      const secret =
        new TextEncoder().encode(
          process.env.ADMIN_SECRET
        );

      const { payload } =
        await jwtVerify(
          token,
          secret,
          {
            issuer: "alljobsindia",
            audience: "alljobsindia-admin",
            algorithms: ["HS256"],
          }
        );

      if (payload.admin !== true) {
        throw new Error("Invalid admin token");
      }

      return NextResponse.next();
    } catch {
      const response =
        NextResponse.redirect(
          new URL(
            "/admin/login",
            request.url
          )
        );

      response.cookies.delete(
        ADMIN_COOKIE
      );

      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
