"use client";

import { useAuth } from "@/lib/auth/context";
import type React from "react";
import Sidebar from "@/components/app/Sidebar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user } = useAuth();
  return (
    <div className="app-layout w-screen h-screen flex overflow-hidden">
      <div className="w-80 h-screen">
        {user?.id && <Sidebar userID={user.id} />}
      </div>
      <main className="main-content flex-1 h-screen overflow-auto">
        {children}
      </main>
    </div>
  );
}
