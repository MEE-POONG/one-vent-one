import { NextResponse, type NextRequest } from "next/server";
import { currentStaff } from "@/server/auth";

// Hides the back office from everyone except staff, with a real 404 status, so
// /admin looks exactly like a page that does not exist.
//
// The admin layout makes the same check, but the root loading.tsx starts
// streaming before the layout finishes, and that locks the status at 200.
// Checking here, before rendering starts, is what makes the status 404.
//
// This is not the security boundary. Every /api/admin route enforces
// permissions on its own. Visitors without a session cookie never reach the
// database; staff pay one indexed session lookup per back-office request.
export async function proxy(request: NextRequest) {
  if (await currentStaff(request)) return NextResponse.next();
  // /404 has no route, so this renders the site's ordinary not-found page.
  return NextResponse.rewrite(new URL("/404", request.url));
}

export const config = { matcher: "/admin/:path*" };
