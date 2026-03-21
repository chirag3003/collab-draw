/**
 * Centralized GraphQL response and input types for the Collab Draw frontend.
 *
 * These types correspond to the GraphQL schema defined in `packages/api/graph/*.graphqls`
 * and are used across hooks, components, and the OT engine.
 */

// ─── Project Types ───────────────────────────────────────────────────────────

/** Summary of a project as returned by list queries. */
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  owner: string;
  createdAt: string;
}

/** Full project detail including canvas elements (JSON-serialized). */
export interface ProjectDetail {
  name: string;
  description: string;
  workspace: string;
  elements: string;
}

// ─── Workspace Types ─────────────────────────────────────────────────────────

/** A workspace member (owner or collaborator). */
export interface WorkspaceMember {
  id: string;
  fullName: string;
  email: string;
  imageURL?: string;
}

/** The membership structure of a workspace, including owner and invited members. */
export interface WorkspaceMembers {
  owner: WorkspaceMember;
  members: WorkspaceMember[];
}

/** Full workspace detail including membership. */
export interface Workspace {
  id: string;
  name: string;
  description: string;
  members: WorkspaceMembers;
}

/** Workspace summary without membership details. */
export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string;
}

// ─── Presence & Cursor Types ─────────────────────────────────────────────────

/** A cursor movement event received from a remote collaborator. */
export interface CursorEvent {
  userID: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  selectedElementIds: string[];
  timestamp: string;
}

/** A presence user entry indicating who is active on a project. */
export interface PresenceUser {
  userID: string;
  userName: string;
  email: string;
  status: "ACTIVE" | "IDLE";
  joinedAt: string;
}

// ─── OT / Operations Types ──────────────────────────────────────────────────

/** The result of an `applyOps` mutation. */
export interface ApplyOpsResult {
  ack: boolean;
  serverSeq: number;
  rejected: RejectedOp[] | null;
}

/** A single rejected operation from the server. */
export interface RejectedOp {
  clientSeq: number;
  elementID: string;
  reason: string;
}

/** A remote operation received via subscription or catch-up query. */
export interface RemoteOp {
  opID: string;
  seq: number;
  clientSeq: number;
  socketID: string;
  type: "ADD" | "UPDATE" | "DELETE";
  elementID: string;
  elementVer: number;
  baseSeq: number;
  data: string | null;
  timestamp: string;
}
