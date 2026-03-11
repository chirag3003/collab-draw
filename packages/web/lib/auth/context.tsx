"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { SessionUser } from "./session";

/** Shape of the authentication context value. */
interface AuthContextValue {
  user: SessionUser | null;
  accessToken: string | null;
  status: "authenticated" | "unauthenticated";
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  accessToken: null,
  status: "unauthenticated",
  signOut: () => {},
});

interface AuthProviderProps {
  children: ReactNode;
  session: { user: SessionUser; accessToken: string } | null;
}

/** Interval between proactive token refresh attempts (4 minutes). */
const REFRESH_INTERVAL_MS = 4 * 60 * 1000;

/**
 * Provides authentication state to the component tree.
 *
 * Receives a server-resolved session (or `null`) and exposes it via
 * React context. A background timer polls `/api/auth/session` before
 * the token expires, keeping the client-side token fresh without
 * requiring a full page reload.
 *
 * The `signOut` callback navigates to the server-side sign-out route.
 */
export function AuthProvider({ children, session }: AuthProviderProps) {
  const [currentSession, setCurrentSession] = useState(session);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAuthenticated = currentSession !== null;

  const signOut = useCallback(() => {
    window.location.href = "/api/auth/signout";
  }, []);

  // ── Background token refresh ─────────────────────────────────────────

  useEffect(() => {
    // Only poll if the user is authenticated
    if (!isAuthenticated) return;

    /**
     * Fetches a fresh session from the server-side route handler.
     * `getSession()` inside the route handler transparently refreshes
     * expired Keycloak tokens and persists the updated cookie.
     */
    async function refreshToken() {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          // Session expired and refresh failed — sign out
          if (res.status === 401) {
            setCurrentSession(null);
          }
          return;
        }
        const data = await res.json();
        if (data?.accessToken) {
          setCurrentSession({
            user: data.user,
            accessToken: data.accessToken,
          });
        }
      } catch {
        // Network error — silently retry on next interval
      }
    }

    refreshTimerRef.current = setInterval(refreshToken, REFRESH_INTERVAL_MS);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [isAuthenticated]);

  const value: AuthContextValue = {
    user: currentSession?.user ?? null,
    accessToken: currentSession?.accessToken ?? null,
    status: currentSession ? "authenticated" : "unauthenticated",
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Returns the current authentication context.
 *
 * Must be used within an {@link AuthProvider}.
 *
 * @returns The auth context with `user`, `accessToken`, `status`, and `signOut`.
 */
export function useAuth() {
  return useContext(AuthContext);
}
