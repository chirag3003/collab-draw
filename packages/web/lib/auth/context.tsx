"use client";

import { createContext, type ReactNode, useCallback, useContext } from "react";
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

/**
 * Provides authentication state to the component tree.
 *
 * Receives a server-resolved session (or `null`) and exposes it via
 * React context. The `signOut` callback navigates to the server-side
 * sign-out route.
 */
export function AuthProvider({ children, session }: AuthProviderProps) {
  const signOut = useCallback(() => {
    window.location.href = "/api/auth/signout";
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    status: session ? "authenticated" : "unauthenticated",
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
