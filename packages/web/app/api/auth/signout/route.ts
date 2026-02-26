import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const cookie = clearSessionCookie();
  const cookieStore = await cookies();
  cookieStore.set(cookie.name, cookie.value, cookie.options);
  return NextResponse.redirect(new URL("/", request.nextUrl.origin));
}
