import { gql } from "@apollo/client";
import {
  useLazyQuery,
  useMutation,
  useSubscription,
} from "@apollo/client/react";

// --- Cursor Hooks ---

export const useUpdateCursor = () => {
  const MUTATION = gql`
    mutation UpdateCursor($projectID: ID!, $cursor: CursorInput!) {
      updateCursor(projectID: $projectID, cursor: $cursor)
    }
  `;
  return useMutation<{ updateCursor: boolean }>(MUTATION);
};

export const useCursorsSubscription = (projectID: string, skip: boolean) => {
  const SUBSCRIPTION = gql`
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
  return useSubscription<{
    cursors: {
      userID: string;
      userName: string;
      color: string;
      x: number;
      y: number;
      selectedElementIds: string[];
      timestamp: string;
    };
  }>(SUBSCRIPTION, {
    variables: { projectID },
    skip,
    shouldResubscribe: true,
  });
};

// --- Presence Hooks ---

export const usePresenceSubscription = (projectID: string, skip: boolean) => {
  const SUBSCRIPTION = gql`
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
  return useSubscription<{
    presence: Array<{
      userID: string;
      userName: string;
      email: string;
      status: "ACTIVE" | "IDLE";
      joinedAt: string;
    }>;
  }>(SUBSCRIPTION, {
    variables: { projectID },
    skip,
    shouldResubscribe: true,
  });
};
