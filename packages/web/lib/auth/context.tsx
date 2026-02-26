"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import type { SessionUser } from "./session";

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

export function useAuth() {
  return useContext(AuthContext);
}
