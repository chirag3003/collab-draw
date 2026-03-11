/**
 * Centralized GraphQL operation definitions for the Collab Draw frontend.
 *
 * All `gql` template literals are defined here as named constants, replacing
 * inline definitions previously scattered across individual hook files.
 *
 * Naming convention:
 * - Queries:        `GET_*` or descriptive noun (e.g. `OPS_SINCE`)
 * - Mutations:      `CREATE_*`, `UPDATE_*`, `DELETE_*`, `APPLY_*`, `ADD_*`, `REMOVE_*`
 * - Subscriptions:  `*_SUBSCRIPTION`
 */

import { gql } from "@apollo/client";

// ─── Project Queries ─────────────────────────────────────────────────────────

/** Fetches a single project by ID with full element data. */
export const GET_PROJECT_BY_ID = gql`
  query getProjectByID($ID: ID!) {
    project(id: $ID) {
      name
      description
      workspace
      elements
    }
  }
`;

/** Fetches a project name only (used for page title / metadata). */
export const GET_PROJECT_NAME = gql`
  query GetProject($id: ID!) {
    project(id: $id) {
      name
    }
  }
`;

/** Fetches all personal projects for a user. */
export const GET_PERSONAL_PROJECTS = gql`
  query GetProjectByOwner($ID: ID!) {
    projectsPersonalByUser(userId: $ID) {
      id
      name
      description
      owner
      createdAt
    }
  }
`;

/** Fetches all projects belonging to a workspace. */
export const GET_PROJECTS_BY_WORKSPACE = gql`
  query GetProjectByWorkspace($ID: ID!) {
    projectsByWorkspace(workspaceId: $ID) {
      id
      name
      description
      owner
      createdAt
    }
  }
`;

// ─── Project Mutations ───────────────────────────────────────────────────────

/** Creates a new project (personal or within a workspace). */
export const CREATE_PROJECT = gql`
  mutation createProject(
    $name: String!
    $description: String!
    $owner: ID!
    $personal: Boolean!
    $workspace: ID
  ) {
    createProject(
      input: {
        name: $name
        description: $description
        owner: $owner
        personal: $personal
        workspace: $workspace
      }
    )
  }
`;

/** Deletes a project by ID. */
export const DELETE_PROJECT = gql`
  mutation DeleteProject($ID: ID!) {
    deleteProject(id: $ID)
  }
`;

/** Updates a project's name and description. */
export const UPDATE_PROJECT_METADATA = gql`
  mutation UpdateProjectMetadata(
    $ID: ID!
    $name: String!
    $description: String!
  ) {
    updateProjectMetadata(id: $ID, name: $name, description: $description)
  }
`;

// ─── OT Mutations & Queries ─────────────────────────────────────────────────

/** Sends a batch of OT operations to the server for a project. */
export const APPLY_OPS = gql`
  mutation ApplyOps($projectID: ID!, $socketID: ID!, $ops: [OperationInput!]!) {
    applyOps(projectID: $projectID, socketID: $socketID, ops: $ops) {
      ack
      serverSeq
      rejected {
        clientSeq
        elementID
        reason
      }
    }
  }
`;

/** Fetches operations that occurred after a given server sequence number. */
export const OPS_SINCE = gql`
  query OpsSince($projectID: ID!, $sinceSeq: Int!, $limit: Int) {
    opsSince(projectID: $projectID, sinceSeq: $sinceSeq, limit: $limit) {
      opID
      seq
      clientSeq
      socketID
      type
      elementID
      elementVer
      baseSeq
      data
      timestamp
    }
  }
`;

// ─── Project Subscriptions ───────────────────────────────────────────────────

/** Subscribes to real-time OT operations for a project. */
export const PROJECT_OPS_SUBSCRIPTION = gql`
  subscription ProjectOps($ID: ID!) {
    projectOps(id: $ID) {
      ops {
        opID
        seq
        clientSeq
        socketID
        type
        elementID
        elementVer
        baseSeq
        data
        timestamp
      }
      socketID
    }
  }
`;

// ─── Workspace Queries ───────────────────────────────────────────────────────

/** Fetches a single workspace by ID with full membership details. */
export const GET_WORKSPACE = gql`
  query GetWorkspace($ID: ID!) {
    workspace(id: $ID) {
      id
      name
      description
      members {
        owner {
          id
          imageURL
          fullName
          email
        }
        members {
          id
          fullName
          email
          imageURL
        }
      }
    }
  }
`;

/** Fetches all workspaces owned by a user. */
export const GET_WORKSPACES_BY_USER = gql`
  query GetWorkspaceByID($user: ID!) {
    workspacesByUser(userId: $user) {
      id
      name
      description
    }
  }
`;

/** Fetches all workspaces shared with a user. */
export const GET_SHARED_WORKSPACES = gql`
  query GetSharedWorkspace($ID: ID!) {
    sharedWorkspacesByUser(userId: $ID) {
      id
      name
      description
    }
  }
`;

// ─── Workspace Mutations ─────────────────────────────────────────────────────

/** Creates a new workspace. */
export const CREATE_WORKSPACE = gql`
  mutation CreateWorkspace(
    $name: String!
    $description: String!
    $owner: ID!
  ) {
    createWorkspace(
      input: { name: $name, description: $description, owner: $owner }
    )
  }
`;

/** Adds a member to a workspace by email. */
export const ADD_USER_TO_WORKSPACE = gql`
  mutation AddUserToWorkspace($ID: ID!, $email: String!) {
    addMemberToWorkspace(workspaceId: $ID, email: $email)
  }
`;

/** Removes a member from a workspace by user ID. */
export const REMOVE_USER_FROM_WORKSPACE = gql`
  mutation RemoveUserFromWorkspace($ID: ID!, $userID: ID!) {
    removeMemberFromWorkspace(workspaceId: $ID, userId: $userID)
  }
`;

/** Deletes a workspace by ID. */
export const DELETE_WORKSPACE = gql`
  mutation DeleteWorkspace($ID: ID!) {
    deleteWorkspace(id: $ID)
  }
`;

/** Updates a workspace's name and description. */
export const UPDATE_WORKSPACE_METADATA = gql`
  mutation UpdateWorkspaceMetadata(
    $ID: ID!
    $name: String!
    $description: String!
  ) {
    updateWorkspaceMetadata(id: $ID, name: $name, description: $description)
  }
`;

// ─── Cursor & Presence ───────────────────────────────────────────────────────

/** Sends the current user's cursor position to a project. */
export const UPDATE_CURSOR = gql`
  mutation UpdateCursor($projectID: ID!, $cursor: CursorInput!) {
    updateCursor(projectID: $projectID, cursor: $cursor)
  }
`;

/** Subscribes to real-time cursor movements from other collaborators. */
export const CURSORS_SUBSCRIPTION = gql`
  subscription Cursors($projectID: ID!) {
    cursors(projectID: $projectID) {
      userID
      userName
      color
      x
      y
      selectedElementIds
      timestamp
    }
  }
`;

/** Subscribes to presence updates (who is active/idle on a project). */
export const PRESENCE_SUBSCRIPTION = gql`
  subscription Presence($projectID: ID!) {
    presence(projectID: $projectID) {
      userID
      userName
      email
      status
      joinedAt
    }
  }
`;

// ─── History ─────────────────────────────────────────────────────────────────

/** Fetches the operation history for a project within a sequence range. */
export const PROJECT_HISTORY = gql`
  query ProjectHistory($projectID: ID!, $fromSeq: Int!, $toSeq: Int!) {
    projectHistory(projectID: $projectID, fromSeq: $fromSeq, toSeq: $toSeq) {
      opID
      seq
      clientSeq
      socketID
      type
      elementID
      elementVer
      baseSeq
      data
      timestamp
    }
  }
`;

/** Fetches a reconstructed snapshot of a project at a specific sequence number. */
export const PROJECT_SNAPSHOT_AT = gql`
  query ProjectSnapshotAt($projectID: ID!, $seq: Int!) {
    projectSnapshotAt(projectID: $projectID, seq: $seq) {
      elements
      seq
      timestamp
    }
  }
`;
