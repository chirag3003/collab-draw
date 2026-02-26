import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createPkceCookie } from "@/lib/auth/session";

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// Resolve the app's public-facing origin (avoids 0.0.0.0 inside Docker)
function getAppOrigin(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const appOrigin = getAppOrigin(request);
  const { searchParams } = request.nextUrl;
  let callbackUrl = searchParams.get("callbackUrl") || "/app";

  // Validate callbackUrl is same-origin (relative path or same host)
  try {
    const url = new URL(callbackUrl, appOrigin);
    if (url.origin !== appOrigin) {
      callbackUrl = "/app";
    }
  } catch {
    callbackUrl = "/app";
  }

  const state = crypto.randomBytes(32).toString("base64url");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store PKCE data in encrypted cookie
  const pkceCookie = createPkceCookie({ state, codeVerifier, callbackUrl });
  const cookieStore = await cookies();
  cookieStore.set(pkceCookie.name, pkceCookie.value, pkceCookie.options);

  // Build Keycloak authorization URL (browser-facing URL)
  const keycloakPublic = process.env.NEXT_PUBLIC_KEYCLOAK_URL!;
  const realm = process.env.KEYCLOAK_REALM!;
  const clientId = process.env.KEYCLOAK_CLIENT_ID!;
  const redirectUri = `${appOrigin}/api/auth/callback`;

  const authUrl = new URL(
    `${keycloakPublic}/realms/${realm}/protocol/openid-connect/auth`,
  );
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(authUrl.toString());
}
