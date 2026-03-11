import { useMutation, useSubscription } from "@apollo/client/react";
import {
  CURSORS_SUBSCRIPTION,
  PRESENCE_SUBSCRIPTION,
  UPDATE_CURSOR,
} from "@/lib/graphql/operations";
import type { CursorEvent, PresenceUser } from "@/lib/types";

// ─── Cursor Hooks ────────────────────────────────────────────────────────────

/**
 * Mutation hook for sending the current user's cursor position to a project.
 *
 * @returns A mutation tuple for updating the cursor position.
 */
export const useUpdateCursor = () => {
  return useMutation<{ updateCursor: boolean }>(UPDATE_CURSOR);
};

/**
 * Subscribes to real-time cursor movements from other collaborators.
 * Invokes the `onCursor` callback each time a remote cursor event is received.
 *
 * @param projectID - The project to subscribe to cursor events for.
 * @param skip - Whether to skip the subscription.
 * @param onCursor - Optional callback invoked with each incoming cursor event.
 * @returns Apollo `useSubscription` result.
 */
export const useCursorsSubscription = (
  projectID: string,
  skip: boolean,
  onCursor?: (cursor: CursorEvent) => void,
) => {
  return useSubscription<{ cursors: CursorEvent }>(CURSORS_SUBSCRIPTION, {
    variables: { projectID },
    skip,
    shouldResubscribe: true,
    onData: ({ data }) => {
      const cursor = data.data?.cursors;
      if (!cursor) return;
      onCursor?.(cursor);
    },
  });
};

// ─── Presence Hooks ──────────────────────────────────────────────────────────

/**
 * Subscribes to presence updates for a project (who is active or idle).
 *
 * @param projectID - The project to subscribe to presence for.
 * @param skip - Whether to skip the subscription.
 * @returns Apollo `useSubscription` result with the list of present users.
 */
export const usePresenceSubscription = (projectID: string, skip: boolean) => {
  return useSubscription<{ presence: PresenceUser[] }>(PRESENCE_SUBSCRIPTION, {
    variables: { projectID },
    skip,
    shouldResubscribe: true,
  });
};
