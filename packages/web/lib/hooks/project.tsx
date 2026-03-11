import {
  useLazyQuery,
  useMutation,
  useQuery,
  useSubscription,
} from "@apollo/client/react";
import {
  CREATE_PROJECT,
  DELETE_PROJECT,
  GET_PERSONAL_PROJECTS,
  GET_PROJECT_BY_ID,
  GET_PROJECTS_BY_WORKSPACE,
  PROJECT_OPS_SUBSCRIPTION,
  UPDATE_PROJECT_METADATA,
} from "@/lib/graphql/operations";
import type { ProjectDetail, ProjectSummary } from "@/lib/types";

/**
 * Fetches a single project by ID with network-first policy.
 * Falls back to cache after the initial fetch for subsequent renders.
 *
 * @param projectID - The unique identifier of the project to fetch.
 * @returns Apollo `useQuery` result containing the project detail.
 */
export const useProjectByID = (projectID: string) => {
  return useQuery<{ project: ProjectDetail }>(GET_PROJECT_BY_ID, {
    variables: { ID: projectID },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first",
  });
};

/**
 * Lazy query for fetching personal projects by user ID.
 * Must be triggered manually via the returned execute function.
 *
 * @returns A tuple of `[executeQuery, queryResult]` for personal projects.
 */
export const usePersonalProjects = () => {
  return useLazyQuery<{ projectsPersonalByUser: ProjectSummary[] }>(
    GET_PERSONAL_PROJECTS,
  );
};

/**
 * Fetches all projects belonging to a workspace.
 *
 * @param workspaceID - The workspace whose projects to fetch.
 * @returns Apollo `useQuery` result containing the workspace's projects.
 */
export const useProjectsByWorkspace = (workspaceID: string) => {
  return useQuery<{ projectsByWorkspace: ProjectSummary[] }>(
    GET_PROJECTS_BY_WORKSPACE,
    { variables: { ID: workspaceID } },
  );
};

/**
 * Creates a new project (personal or within a workspace).
 * Automatically refetches personal and workspace project lists on success.
 *
 * @returns A mutation tuple for creating a project.
 */
export const useCreateProject = () => {
  return useMutation(CREATE_PROJECT, {
    refetchQueries: ["GetProjectByOwner", "GetProjectByWorkspace"],
  });
};

/**
 * Deletes a project by ID.
 * Automatically refetches personal and workspace project lists on success.
 *
 * @returns A mutation tuple for deleting a project.
 */
export function useDeleteProject() {
  return useMutation(DELETE_PROJECT, {
    refetchQueries: ["GetProjectByOwner", "GetProjectByWorkspace"],
  });
}

/**
 * Updates a project's name and description metadata.
 * Automatically refetches personal and workspace project lists on success.
 *
 * @returns A mutation tuple for updating project metadata.
 */
export function useUpdateProjectMetadata() {
  return useMutation(UPDATE_PROJECT_METADATA, {
    refetchQueries: ["GetProjectByOwner", "GetProjectByWorkspace"],
  });
}

// ─── OT Subscription ────────────────────────────────────────────────────────

/**
 * Subscribes to real-time OT operations for a project.
 * The first message delivers the assigned socketID; subsequent messages
 * contain batches of remote operations.
 *
 * @param projectID - The project to subscribe to.
 * @param skip - Whether to skip the subscription (e.g., until Excalidraw API is ready).
 * @returns Apollo `useSubscription` result with ops and socketID.
 */
export const useProjectOpsSubscription = (projectID: string, skip: boolean) => {
  return useSubscription<{
    projectOps: {
      ops: Array<{
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
      }>;
      socketID: string;
    };
  }>(PROJECT_OPS_SUBSCRIPTION, {
    variables: { ID: projectID },
    skip,
    shouldResubscribe: true,
    onError: (error) => {
      console.error("ProjectOps subscription error:", error);
    },
  });
};
