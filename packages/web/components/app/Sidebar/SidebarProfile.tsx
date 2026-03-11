"use client";

import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

interface SidebarProfileProps {
  /** User display name. */
  name: string | undefined;
  /** User email address. */
  email: string | undefined;
  /** User avatar image URL. */
  image: string | undefined;
  /** Keycloak account settings URL. */
  accountUrl: string;
  /** Sign-out callback. */
  onSignOut: () => void;
}

/**
 * Renders the current user's profile row at the bottom of the sidebar.
 * Includes avatar, name, email, a link to Keycloak account settings,
 * and a sign-out button.
 */
export default function SidebarProfile({
  name,
  email,
  image,
  accountUrl,
  onSignOut,
}: SidebarProfileProps) {
  return (
    <div className="flex items-center gap-3 mt-4 p-3 rounded-lg hover:bg-sidebar-accent/30 transition-colors">
      <Avatar className="h-10 w-10 ring-2 ring-sidebar-border">
        <AvatarImage src={image || undefined} alt={name || "User"} />
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
          {getInitials(name ?? "")}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 overflow-hidden min-w-0">
        <h2 className="font-semibold text-sidebar-foreground text-sm truncate">
          {name}
        </h2>
        <p className="text-xs text-sidebar-foreground/60 truncate">{email}</p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <Link href={accountUrl} target="_blank">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-sidebar-accent"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          onClick={onSignOut}
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
