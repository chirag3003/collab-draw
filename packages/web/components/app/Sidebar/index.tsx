"use client";

import { useAuth } from "@/lib/auth/context";
import {
  FileText,
  FolderOpen,
  LogOut,
  Search,
  Settings,
  Users,
  Home,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useCreateWorkspace,
  useSharedWorkspaces,
  useWorkspaces,
} from "@/lib/hooks/workspace";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userID: string;
}

export default function Sidebar({ userID }: SidebarProps) {
  const { user: sessionUser, signOut } = useAuth();
  const { data: workspaces } = useWorkspaces(userID);
  const { data: sharedWorkspaces } = useSharedWorkspaces(userID);
  const pathname = usePathname();
  const [createWorkspace] = useCreateWorkspace();
  const [searchQuery, setSearchQuery] = useState("");
  const [myWorkspacesExpanded, setMyWorkspacesExpanded] = useState(true);
  const [sharedWorkspacesExpanded, setSharedWorkspacesExpanded] = useState(true);

  // Determine current view based on pathname
  const isPersonalView = pathname === "/app";
  const currentWorkspaceId = pathname.startsWith("/app/") ? pathname.split("/app/")[1] : null;

  // Determine which workspace type is active
  const isInSharedWorkspace = useMemo(() => {
    if (!currentWorkspaceId) return false;
    return sharedWorkspaces?.sharedWorkspacesByUser?.some(ws => ws.id === currentWorkspaceId) ?? false;
  }, [currentWorkspaceId, sharedWorkspaces]);

  const isInMyWorkspace = useMemo(() => {
    if (!currentWorkspaceId) return false;
    return workspaces?.workspacesByUser?.some(ws => ws.id === currentWorkspaceId) ?? false;
  }, [currentWorkspaceId, workspaces]);

  // Filter workspaces based on search
  const filteredMyWorkspaces = useMemo(() => {
    const list = workspaces?.workspacesByUser ?? [];
    if (!searchQuery.trim()) return list;
    return list.filter(ws =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [workspaces, searchQuery]);

  const filteredSharedWorkspaces = useMemo(() => {
    const list = sharedWorkspaces?.sharedWorkspacesByUser ?? [];
    if (!searchQuery.trim()) return list;
    return list.filter(ws =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sharedWorkspaces, searchQuery]);

  const handleCreateWorkspace = async (data: {
    title: string;
    description: string;
  }) => {
    await createWorkspace({
      variables: {
        name: data.title,
        description: data.description,
        owner: userID,
      },
    });
  };

  const keycloakAccountUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL
    ? `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "collab-draw"}/account`
    : "#";

  return (
    <div className="w-80 h-screen border-r border-sidebar-border flex flex-col bg-sidebar">
      {/* Header with Logo */}
      <div className="p-6 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">Collab Draw</h1>
            <p className="text-xs text-sidebar-foreground/60">Your Workspaces</p>
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <div className="px-4 py-4 space-y-2 flex-1 overflow-hidden flex flex-col">
        {/* Personal Projects - Clear Active State */}
        <Link
          href="/app"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all",
            isPersonalView
              ? "bg-primary text-primary-foreground shadow-sm"
              : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
          )}
        >
          <Home className="h-5 w-5 flex-shrink-0" />
          <span className="flex-1">Personal Projects</span>
          {isPersonalView && <ChevronRight className="h-4 w-4" />}
        </Link>

        {/* Divider */}
        <div className="relative py-3">
          <div className="absolute inset-0 flex items-center px-4">
            <div className="w-full border-t border-sidebar-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-sidebar px-3 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              Team Workspaces
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="relative px-2">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-sidebar-accent/30 border-sidebar-border"
          />
        </div>

        {/* Workspace Lists */}
        <div className="flex-1 overflow-y-auto space-y-4 px-2 py-2">
          {/* My Workspaces Section */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setMyWorkspacesExpanded(!myWorkspacesExpanded)}
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-sidebar-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-sidebar-foreground/60 transition-transform",
                    myWorkspacesExpanded && "rotate-90"
                  )}
                />
                <FolderOpen className="h-4 w-4 text-sidebar-foreground/60" />
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                  My Workspaces
                </h3>
              </div>
              <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
                {filteredMyWorkspaces.length}
              </Badge>
            </button>
            {myWorkspacesExpanded && (
              <div className="space-y-0.5 pl-2">
                {filteredMyWorkspaces.length > 0 ? (
                  filteredMyWorkspaces.map((workspace) => (
                    <Link
                      href={`/app/${workspace.id}`}
                      key={workspace.id}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                        currentWorkspaceId === workspace.id && isInMyWorkspace
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                      )}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">
                        {workspace.name}
                      </span>
                      {currentWorkspaceId === workspace.id && isInMyWorkspace && (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-sidebar-foreground/50 px-3 py-2">
                    {searchQuery ? "No workspaces found" : "No workspaces yet"}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Shared Workspaces Section */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setSharedWorkspacesExpanded(!sharedWorkspacesExpanded)}
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-sidebar-accent/30 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-sidebar-foreground/60 transition-transform",
                    sharedWorkspacesExpanded && "rotate-90"
                  )}
                />
                <Users className="h-4 w-4 text-sidebar-foreground/60" />
                <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                  Shared with Me
                </h3>
              </div>
              <Badge variant="secondary" className="text-xs h-5 min-w-[20px] justify-center">
                {filteredSharedWorkspaces.length}
              </Badge>
            </button>
            {sharedWorkspacesExpanded && (
              <div className="space-y-0.5 pl-2">
                {filteredSharedWorkspaces.length > 0 ? (
                  filteredSharedWorkspaces.map((workspace) => (
                    <Link
                      href={`/app/${workspace.id}`}
                      key={workspace.id}
                      className={cn(
                        "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                        currentWorkspaceId === workspace.id && isInSharedWorkspace
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground"
                      )}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">
                        {workspace.name}
                      </span>
                      {currentWorkspaceId === workspace.id && isInSharedWorkspace && (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                    </Link>
                  ))
                ) : (
                  <p className="text-xs text-sidebar-foreground/50 px-3 py-2">
                    {searchQuery ? "No workspaces found" : "No shared workspaces"}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* User Profile Section */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar">
        {/* New Workspace Button - Prominent */}
        <CreateWorkspaceDialog onCreateWorkspace={handleCreateWorkspace} />

        {/* User Profile */}
        <div className="flex items-center gap-3 mt-4 p-3 rounded-lg hover:bg-sidebar-accent/30 transition-colors">
          <Avatar className="h-10 w-10 ring-2 ring-sidebar-border">
            <AvatarImage src={sessionUser?.image || undefined} alt={sessionUser?.name || "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
              {sessionUser?.name?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden min-w-0">
            <h2 className="font-semibold text-sidebar-foreground text-sm truncate">
              {sessionUser?.name}
            </h2>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {sessionUser?.email}
            </p>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Link href={keycloakAccountUrl} target="_blank">
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
              onClick={() => signOut()}
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
