"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronRight, FileText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WorkspaceEntry {
  id: string;
  name: string;
  description?: string;
}

interface WorkspaceListProps {
  /** Section title displayed in the header button. */
  title: string;
  /** Icon rendered beside the title. */
  icon: LucideIcon;
  /** Workspace entries to render. */
  workspaces: WorkspaceEntry[];
  /** Whether the section is expanded (controlled). */
  expanded: boolean;
  /** Toggle callback. */
  onToggle: () => void;
  /** ID of the currently active workspace (from the URL). */
  activeWorkspaceId: string | null;
  /** Whether the active workspace belongs to this list. */
  isActiveInThisList: boolean;
  /** Empty-state text when there are no workspaces. */
  emptyText: string;
  /** Text when search yields no results. */
  emptySearchText?: string;
  /** Whether a search query is active (switches empty text). */
  hasSearchQuery: boolean;
}

/**
 * A collapsible workspace list section used in the sidebar.
 * Renders a header with an expand/collapse chevron, a badge count,
 * and the list of workspace links.
 */
export default function WorkspaceList({
  title,
  icon: Icon,
  workspaces,
  expanded,
  onToggle,
  activeWorkspaceId,
  isActiveInThisList,
  emptyText,
  emptySearchText = "No workspaces found",
  hasSearchQuery,
}: WorkspaceListProps) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-2 rounded-lg hover:bg-sidebar-accent/30 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              "h-4 w-4 text-sidebar-foreground/60 transition-transform",
              expanded && "rotate-90",
            )}
          />
          <Icon className="h-4 w-4 text-sidebar-foreground/60" />
          <h3 className="text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
            {title}
          </h3>
        </div>
        <Badge
          variant="secondary"
          className="text-xs h-5 min-w-[20px] justify-center"
        >
          {workspaces.length}
        </Badge>
      </button>

      {expanded && (
        <div className="space-y-0.5 pl-2">
          {workspaces.length > 0 ? (
            workspaces.map((workspace) => {
              const isActive =
                activeWorkspaceId === workspace.id && isActiveInThisList;
              return (
                <Link
                  href={`/app/${workspace.id}`}
                  key={workspace.id}
                  className={cn(
                    "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 hover:text-sidebar-foreground",
                  )}
                >
                  <FileText className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">
                    {workspace.name}
                  </span>
                  {isActive && (
                    <ChevronRight className="h-4 w-4 flex-shrink-0" />
                  )}
                </Link>
              );
            })
          ) : (
            <p className="text-xs text-sidebar-foreground/50 px-3 py-2">
              {hasSearchQuery ? emptySearchText : emptyText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
