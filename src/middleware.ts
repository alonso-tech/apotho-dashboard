import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  if (!token) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!sign-in|api/auth|api/seed-q2|api/assign-integrator|api/audit-rocks|api/debug|api/sync-scorecard|api/financials|_next/static|_next/image|favicon.ico).*)"],
};
