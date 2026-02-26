import { cookies } from "next/headers";
import crypto from "node:crypto";

const COOKIE_NAME = "collab-session";
const PKCE_COOKIE_NAME = "auth-pkce";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: SessionUser;
}

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is required");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(payload: unknown): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt<T = unknown>(encoded: string): T {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}

const keycloakTokenUrl = () => {
  const base = process.env.KEYCLOAK_URL!;
  const realm = process.env.KEYCLOAK_REALM!;
  return `${base}/realms/${realm}/protocol/openid-connect/token`;
};

async function refreshSession(session: Session): Promise<Session | null> {
  try {
    const res = await fetch(keycloakTokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
        refresh_token: session.refreshToken,
      }),
    });

    if (!res.ok) return null;

    const tokens = await res.json();
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + tokens.expires_in,
      user: session.user,
    };
  } catch {
    return null;
  }
}

// Module-level promise cache to prevent concurrent refresh races
let refreshPromise: Promise<Session | null> | null = null;

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie?.value) return null;

    const session = decrypt<Session>(cookie.value);

    // Check if token is expired (with 60s buffer)
    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt <= now + 60 && session.refreshToken) {
      // Deduplicate concurrent refresh calls
      if (!refreshPromise) {
        refreshPromise = refreshSession(session).finally(() => {
          refreshPromise = null;
        });
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        // Set the refreshed cookie
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, encrypt(refreshed), sessionCookieOptions());
        return refreshed;
      }
      // Refresh failed — return null (session expired)
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  };
}

export function createSessionCookie(session: Session) {
  return {
    name: COOKIE_NAME,
    value: encrypt(session),
    options: sessionCookieOptions(),
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    },
  };
}

export interface PkceData {
  state: string;
  codeVerifier: string;
  callbackUrl: string;
}

export function createPkceCookie(data: PkceData) {
  return {
    name: PKCE_COOKIE_NAME,
    value: encrypt(data),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 600, // 10 minutes
    },
  };
}

export function clearPkceCookie() {
  return {
    name: PKCE_COOKIE_NAME,
    value: "",
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    },
  };
}

export async function getPkceData(): Promise<PkceData | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(PKCE_COOKIE_NAME);
    if (!cookie?.value) return null;
    return decrypt<PkceData>(cookie.value);
  } catch {
    return null;
  }
}
