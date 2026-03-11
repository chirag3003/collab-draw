"use client";

import {
  ChevronRight,
  FileText,
  FolderOpen,
  Home,
  Search,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/context";
import {
  useCreateWorkspace,
  useSharedWorkspaces,
  useWorkspaces,
} from "@/lib/hooks/workspace";
import { cn } from "@/lib/utils";
import CreateWorkspaceDialog from "./CreateWorkspaceDialog";
import SidebarProfile from "./SidebarProfile";
import WorkspaceList from "./WorkspaceList";

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
  const [sharedWorkspacesExpanded, setSharedWorkspacesExpanded] =
    useState(true);

  // ── Derived state ────────────────────────────────────────────────────────

  const isPersonalView = pathname === "/app";
  const currentWorkspaceId = pathname.startsWith("/app/")
    ? pathname.split("/app/")[1]
    : null;

  const isInSharedWorkspace = useMemo(() => {
    if (!currentWorkspaceId) return false;
    return (
      sharedWorkspaces?.sharedWorkspacesByUser?.some(
        (ws) => ws.id === currentWorkspaceId,
      ) ?? false
    );
  }, [currentWorkspaceId, sharedWorkspaces]);

  const isInMyWorkspace = useMemo(() => {
    if (!currentWorkspaceId) return false;
    return (
      workspaces?.workspacesByUser?.some(
        (ws) => ws.id === currentWorkspaceId,
      ) ?? false
    );
  }, [currentWorkspaceId, workspaces]);

  const hasSearchQuery = searchQuery.trim().length > 0;

  const filteredMyWorkspaces = useMemo(() => {
    const list = workspaces?.workspacesByUser ?? [];
    if (!hasSearchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        ws.description?.toLowerCase().includes(q),
    );
  }, [workspaces, searchQuery, hasSearchQuery]);

  const filteredSharedWorkspaces = useMemo(() => {
    const list = sharedWorkspaces?.sharedWorkspacesByUser ?? [];
    if (!hasSearchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (ws) =>
        ws.name.toLowerCase().includes(q) ||
        ws.description?.toLowerCase().includes(q),
    );
  }, [sharedWorkspaces, searchQuery, hasSearchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────

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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-80 h-screen border-r border-sidebar-border flex flex-col bg-sidebar">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">
              Collab Draw
            </h1>
            <p className="text-xs text-sidebar-foreground/60">
              Your Workspaces
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-4 space-y-2 flex-1 overflow-hidden flex flex-col">
        {/* Personal Projects link */}
        <Link
          href="/app"
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all",
            isPersonalView
              ? "bg-primary text-primary-foreground shadow-sm"
              : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground",
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

        {/* Workspace lists */}
        <div className="flex-1 overflow-y-auto space-y-4 px-2 py-2">
          <WorkspaceList
            title="My Workspaces"
            icon={FolderOpen}
            workspaces={filteredMyWorkspaces}
            expanded={myWorkspacesExpanded}
            onToggle={() => setMyWorkspacesExpanded((v) => !v)}
            activeWorkspaceId={currentWorkspaceId}
            isActiveInThisList={isInMyWorkspace}
            emptyText="No workspaces yet"
            hasSearchQuery={hasSearchQuery}
          />
          <WorkspaceList
            title="Shared with Me"
            icon={Users}
            workspaces={filteredSharedWorkspaces}
            expanded={sharedWorkspacesExpanded}
            onToggle={() => setSharedWorkspacesExpanded((v) => !v)}
            activeWorkspaceId={currentWorkspaceId}
            isActiveInThisList={isInSharedWorkspace}
            emptyText="No shared workspaces"
            hasSearchQuery={hasSearchQuery}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border bg-sidebar">
        <CreateWorkspaceDialog onCreateWorkspace={handleCreateWorkspace} />
        <SidebarProfile
          name={sessionUser?.name}
          email={sessionUser?.email}
          image={sessionUser?.image ?? undefined}
          accountUrl={keycloakAccountUrl}
          onSignOut={() => signOut()}
        />
      </div>
    </div>
  );
}
