import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

/**
 * Client-side session refresh endpoint.
 *
 * Returns the current session's `accessToken` and `user` if valid.
 * `getSession()` transparently refreshes expired tokens via Keycloak
 * and persists the updated cookie (safe in Route Handlers).
 *
 * Called by {@link AuthProvider} on a timer to keep the client-side
 * token fresh without a full page reload.
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(null, { status: 401 });
  }

  return NextResponse.json({
    user: session.user,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
  });
}
