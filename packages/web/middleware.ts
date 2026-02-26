import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("collab-session");
  const { pathname } = req.nextUrl;

  // Protect /app and /projects routes — redirect to sign in if not authenticated
  if (!hasSession && (pathname.startsWith("/app") || pathname.startsWith("/projects"))) {
    const signInUrl = new URL("/api/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  // Protect /api/graphql — return 401 if not authenticated
  if (!hasSession && pathname.startsWith("/api/graphql")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app(.*)", "/projects(.*)", "/api/graphql(.*)"],
};
