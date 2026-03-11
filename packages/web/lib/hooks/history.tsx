import { useLazyQuery } from "@apollo/client/react";
import { PROJECT_HISTORY, PROJECT_SNAPSHOT_AT } from "@/lib/graphql/operations";
import type { HistoryOp, ProjectSnapshot } from "@/lib/types";

/**
 * Lazy query for fetching the operation history of a project within a sequence range.
 * Must be triggered manually via the returned execute function.
 *
 * @returns A tuple of `[executeQuery, queryResult]` for project history.
 */
export const useProjectHistory = () => {
  return useLazyQuery<{ projectHistory: HistoryOp[] }>(PROJECT_HISTORY);
};

/**
 * Lazy query for fetching a reconstructed snapshot of a project at a specific
 * server sequence number. Used by the history timeline to preview past states.
 *
 * @returns A tuple of `[executeQuery, queryResult]` for project snapshots.
 */
export const useProjectSnapshot = () => {
  return useLazyQuery<{ projectSnapshotAt: ProjectSnapshot }>(
    PROJECT_SNAPSHOT_AT,
  );
};
