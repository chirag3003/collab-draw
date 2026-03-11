import { useMutation, useQuery } from "@apollo/client/react";
import {
  ADD_USER_TO_WORKSPACE,
  CREATE_WORKSPACE,
  DELETE_WORKSPACE,
  GET_SHARED_WORKSPACES,
  GET_WORKSPACE,
  GET_WORKSPACES_BY_USER,
  REMOVE_USER_FROM_WORKSPACE,
  UPDATE_WORKSPACE_METADATA,
} from "@/lib/graphql/operations";
import type { Workspace, WorkspaceSummary } from "@/lib/types";

/**
 * Fetches a single workspace by ID with full membership details.
 *
 * @param id - The workspace ID to fetch.
 * @returns Apollo `useQuery` result containing the workspace.
 */
export function useWorkspace(id: string) {
  return useQuery<{ workspace: Workspace }>(GET_WORKSPACE, {
    variables: { ID: id },
  });
}

/**
 * Fetches all workspaces owned by a user.
 *
 * @param userID - The owner's user ID.
 * @returns Apollo `useQuery` result containing the user's workspaces.
 */
export function useWorkspaces(userID: string) {
  return useQuery<{ workspacesByUser: WorkspaceSummary[] }>(
    GET_WORKSPACES_BY_USER,
    { variables: { user: userID } },
  );
}

/**
 * Fetches all workspaces shared with a user.
 *
 * @param userID - The user ID to look up shared workspaces for.
 * @returns Apollo `useQuery` result containing shared workspaces.
 */
export function useSharedWorkspaces(userID: string) {
  return useQuery<{ sharedWorkspacesByUser: WorkspaceSummary[] }>(
    GET_SHARED_WORKSPACES,
    { variables: { ID: userID } },
  );
}

/**
 * Creates a new workspace.
 * Automatically refetches the user's workspace list on success.
 *
 * @returns A mutation tuple for creating a workspace.
 */
export function useCreateWorkspace() {
  return useMutation(CREATE_WORKSPACE, {
    refetchQueries: ["GetWorkspaceByID"],
  });
}

/**
 * Adds a member to a workspace by email address.
 * Automatically refetches workspace details on success.
 *
 * @returns A mutation tuple for adding a user to a workspace.
 */
export function useAddUserToWorkspace() {
  return useMutation(ADD_USER_TO_WORKSPACE, {
    refetchQueries: ["GetWorkspace"],
  });
}

/**
 * Removes a member from a workspace by user ID.
 * Automatically refetches workspace details on success.
 *
 * @returns A mutation tuple for removing a user from a workspace.
 */
export function useRemoveUserFromWorkspace() {
  return useMutation(REMOVE_USER_FROM_WORKSPACE, {
    refetchQueries: ["GetWorkspace"],
  });
}

/**
 * Deletes a workspace by ID.
 * Automatically refetches the user's workspace list on success.
 *
 * @returns A mutation tuple for deleting a workspace.
 */
export function useDeleteWorkspace() {
  return useMutation(DELETE_WORKSPACE, {
    refetchQueries: ["GetWorkspaceByID"],
  });
}

/**
 * Updates a workspace's name and description.
 * Automatically refetches workspace details and the user's workspace list on success.
 *
 * @returns A mutation tuple for updating workspace metadata.
 */
export function useUpdateWorkspaceMetadata() {
  return useMutation(UPDATE_WORKSPACE_METADATA, {
    refetchQueries: ["GetWorkspace", "GetWorkspaceByID"],
  });
}
