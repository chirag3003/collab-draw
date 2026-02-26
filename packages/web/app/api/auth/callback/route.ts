import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getPkceData,
  createSessionCookie,
  clearPkceCookie,
  type Session,
} from "@/lib/auth/session";

// Resolve the app's public-facing origin (avoids 0.0.0.0 inside Docker)
function getAppOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin(request);
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?error=missing_params", appOrigin),
    );
  }

  // Validate PKCE state
  const pkceData = await getPkceData();
  if (!pkceData || pkceData.state !== state) {
    return NextResponse.redirect(
      new URL("/?error=invalid_state", appOrigin),
    );
  }

  const keycloakInternal = process.env.KEYCLOAK_URL!;
  const realm = process.env.KEYCLOAK_REALM!;
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const clientSecret = process.env.KEYCLOAK_CLIENT_SECRET!;
  const redirectUri = `${appOrigin}/api/auth/callback`;

  // Exchange code for tokens (server-to-server, internal URL)
  const tokenUrl = `${keycloakInternal}/realms/${realm}/protocol/openid-connect/token`;
  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: pkceData.codeVerifier,
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error("Token exchange failed:", tokenRes.status, errText);
    return NextResponse.redirect(
      new URL("/?error=token_exchange_failed", appOrigin),
    );
  }

  const tokens = await tokenRes.json();

  // Decode user claims from the id_token JWT payload (avoids userinfo call + issuer validation)
  const idTokenParts = tokens.id_token?.split(".");
  if (!idTokenParts || idTokenParts.length !== 3) {
    console.error("Missing or malformed id_token");
    return NextResponse.redirect(new URL("/?error=missing_id_token", appOrigin));
  }
  const userinfo = JSON.parse(Buffer.from(idTokenParts[1], "base64url").toString());

  // Build session
  const session: Session = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
    user: {
      id: userinfo.sub,
      name: userinfo.name ?? userinfo.preferred_username ?? "",
      email: userinfo.email ?? "",
      image: userinfo.picture ?? null,
    },
  };

  // Set session cookie and clear PKCE cookie
  const sessionCookie = createSessionCookie(session);
  const pkceClear = clearPkceCookie();

  const cookieStore = await cookies();
  cookieStore.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
  cookieStore.set(pkceClear.name, pkceClear.value, pkceClear.options);

  return NextResponse.redirect(
    new URL(pkceData.callbackUrl, appOrigin),
  );
}
