import { useApolloClient } from "@apollo/client/react";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { APPLY_OPS, OPS_SINCE } from "@/lib/graphql/operations";
import { useProjectByID, useProjectOpsSubscription } from "@/lib/hooks/project";
import {
  type OperationInput,
  OTClient,
  type RemoteOperation,
} from "@/lib/ot/OTClient";
import type { ApplyOpsResult, RemoteOp } from "@/lib/types";

// ─── Internal mutation / query response shapes ──────────────────────────────

interface ApplyOpsMutationData {
  applyOps: ApplyOpsResult;
}

interface OpsSinceQueryData {
  opsSince: RemoteOp[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/** Connection health indicator surfaced to the UI. */
export type ConnectionStatusType = "connected" | "disconnected" | "syncing";

interface UseOTSyncParams {
  projectID: string;
  excalidrawApi: ExcalidrawImperativeAPI | null;
}

interface UseOTSyncResult {
  /** Current connection / sync status for display. */
  connectionStatus: ConnectionStatusType;
  /** True once the subscription has delivered a socketID and catch-up is done. */
  isRealtimeReady: boolean;
  /** Whether the initial project elements have been loaded into Excalidraw. */
  initialSet: boolean;
  /** Ref to the OTClient instance (needed by history mode for serverSeq). */
  otClientRef: React.RefObject<OTClient | null>;
  /** Ref counter — incremented before calling `updateScene`, decremented in `onChange`. Only process local changes when 0. */
  isRemoteUpdateRef: React.RefObject<number>;
  /** Excalidraw `onChange` handler that diffs local changes through OT. */
  onChange: (elements: readonly OrderedExcalidrawElement[]) => void;
}

/**
 * Duration (ms) to wait for the subscription to recover from an error
 * before redirecting the user. Prevents redirect on brief network blips.
 */
const SUBSCRIPTION_ERROR_GRACE_MS = 10_000;

/**
 * Encapsulates the full OT synchronisation lifecycle:
 *
 * 1. Fetches the initial project data and hydrates Excalidraw.
 * 2. Creates an {@link OTClient} wired to the Apollo client for
 *    `applyOps` mutations and `opsSince` queries.
 * 3. Subscribes to `projectOps` for real-time remote operations.
 * 4. Re-creates the OTClient when `excalidrawApi` changes (preserving
 *    socketID and serverSeq).
 * 5. Tracks connection status and realtime readiness.
 *
 * @returns Stable refs and callbacks that {@link ProjectOT} composes into
 * the Excalidraw component props.
 */
export function useOTSync({
  projectID,
  excalidrawApi,
}: UseOTSyncParams): UseOTSyncResult {
  const apolloClient = useApolloClient();

  const [initialSet, setInitialSet] = useState(false);
  const isRemoteUpdateRef = useRef(0);
  const otClientRef = useRef<OTClient | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatusType>("syncing");
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const initialElementsAppliedRef = useRef<string | null>(null);
  const hasCaughtUpRef = useRef(false);

  // When the subscription delivers a socketID before initial hydration,
  // we defer catch-up until hydration completes.
  const needsCatchUpRef = useRef(false);

  // Timer for graceful redirect on sustained subscription failure.
  const errorRedirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // ── Reset state when projectID changes ─────────────────────────────────

  useEffect(() => {
    if (!projectID) return;
    setInitialSet(false);
    setIsRealtimeReady(false);
    initialElementsAppliedRef.current = null;
    hasCaughtUpRef.current = false;
    needsCatchUpRef.current = false;
  }, [projectID]);

  // ── OT callback factories ─────────────────────────────────────────────

  /**
   * Builds the three callbacks the OTClient needs, closed over the current
   * `apolloClient` and `excalidrawApi`.
   */
  const buildOTCallbacks = useCallback(
    (api: ExcalidrawImperativeAPI | null) => {
      const sendOps = async (ops: OperationInput[]) => {
        const socketID = otClientRef.current?.getSocketID() || "";
        const { data } = await apolloClient.mutate<ApplyOpsMutationData>({
          mutation: APPLY_OPS,
          variables: {
            projectID,
            socketID,
            ops: ops.map((op) => ({
              clientSeq: op.clientSeq,
              type: op.type,
              elementID: op.elementID,
              elementVer: op.elementVer,
              baseSeq: op.baseSeq,
              data: op.data,
            })),
          },
        });
        if (!data?.applyOps) {
          throw new Error("Failed to apply operations");
        }
        return data.applyOps;
      };

      const updateScene = (elements: OrderedExcalidrawElement[]) => {
        if (api) {
          isRemoteUpdateRef.current++;
          api.updateScene({ elements });
        }
      };

      const fetchOpsSince = async (
        sinceSeq: number,
      ): Promise<RemoteOperation[]> => {
        const { data } = await apolloClient.query<OpsSinceQueryData>({
          query: OPS_SINCE,
          variables: { projectID, sinceSeq },
          fetchPolicy: "network-only",
        });
        return (data?.opsSince ?? []).map((op) => ({
          ...op,
          data: op.data ?? undefined,
        }));
      };

      return { sendOps, updateScene, fetchOpsSince };
    },
    [apolloClient, projectID],
  );

  // ── Create / re-create the OTClient ─────────────────────────────────────
  //
  // Merged into a single effect to prevent double-creation on initial mount.
  // When `excalidrawApi` or `buildOTCallbacks` changes, the cleanup destroys
  // the old client (if any) and the new run creates a fresh one, preserving
  // socketID, serverSeq, and the current scene.

  useEffect(() => {
    const savedSocketID = otClientRef.current?.getSocketID() ?? "";
    const savedServerSeq = otClientRef.current?.getServerSeq() ?? 0;

    // Destroy existing client if present
    if (otClientRef.current) {
      otClientRef.current.destroy();
      otClientRef.current = null;
    }

    const { sendOps, updateScene, fetchOpsSince } =
      buildOTCallbacks(excalidrawApi);
    const newOT = new OTClient(sendOps, updateScene, fetchOpsSince);

    // Restore state from previous client (no-ops if both are defaults)
    if (savedSocketID) {
      newOT.setSocketID(savedSocketID);
    }
    if (initialSet && excalidrawApi) {
      const elements = excalidrawApi.getSceneElements();
      newOT.initializeFromScene(elements, savedServerSeq);
    }

    otClientRef.current = newOT;

    return () => {
      otClientRef.current?.destroy();
      otClientRef.current = null;
    };
  }, [excalidrawApi, initialSet, buildOTCallbacks]);

  // ── Fetch initial project data ─────────────────────────────────────────

  const { data: projectData } = useProjectByID(projectID);

  // ── Subscribe to ops ───────────────────────────────────────────────────

  const {
    data: opsData,
    loading: opsLoading,
    error: opsError,
  } = useProjectOpsSubscription(projectID, !excalidrawApi);

  // ── Hydrate Excalidraw with initial elements ───────────────────────────

  useEffect(() => {
    if (!excalidrawApi || !projectData?.project) return;

    try {
      let toParse = projectData.project.elements || "[]";
      if (toParse.trim() === "") toParse = "[]";

      if (initialSet && initialElementsAppliedRef.current === toParse) {
        return;
      }

      const elements = JSON.parse(toParse) as OrderedExcalidrawElement[];

      isRemoteUpdateRef.current++;
      excalidrawApi.updateScene({ elements });

      if (otClientRef.current) {
        otClientRef.current.initializeFromScene(elements);
      }

      initialElementsAppliedRef.current = toParse;
      if (!initialSet) {
        setInitialSet(true);
      }

      // If the subscription already delivered a socketID while we were
      // waiting for initial data, run catch-up now.
      if (needsCatchUpRef.current && otClientRef.current) {
        needsCatchUpRef.current = false;
        hasCaughtUpRef.current = true;
        void otClientRef.current.catchUp();
      }
    } catch (error) {
      console.error("Failed to parse initial elements:", error);
      setInitialSet(true);
    }
  }, [excalidrawApi, projectData, initialSet]);

  // ── Process subscription data (socketID + remote ops) ─────────────────

  useEffect(() => {
    if (!opsData?.projectOps || !otClientRef.current) return;

    const { ops, socketID: subSocketID } = opsData.projectOps;

    // First message (or reconnect): capture socketID
    if (!otClientRef.current.getSocketID() && subSocketID) {
      otClientRef.current.setSocketID(subSocketID);
      setIsRealtimeReady(true);
      setConnectionStatus("connected");

      // Reset hasCaughtUp on every new socketID — this handles both
      // initial connect and reconnects after a WebSocket drop.
      hasCaughtUpRef.current = false;

      if (initialSet) {
        // Scene is hydrated — catch up immediately.
        hasCaughtUpRef.current = true;
        void otClientRef.current.catchUp();
      } else {
        // Scene not yet hydrated — defer catch-up until hydration completes.
        needsCatchUpRef.current = true;
      }
      return;
    }

    // Reconnection: new socketID received while we already had one
    if (subSocketID && subSocketID !== otClientRef.current.getSocketID()) {
      otClientRef.current.setSocketID(subSocketID);
      hasCaughtUpRef.current = false;

      if (initialSet) {
        hasCaughtUpRef.current = true;
        void otClientRef.current.catchUp();
      } else {
        needsCatchUpRef.current = true;
      }
      return;
    }

    // Process remote ops
    if (ops && ops.length > 0) {
      const remoteOps: RemoteOperation[] = ops.map((op) => ({
        ...op,
        data: op.data ?? undefined,
      }));
      const sourceSocketID = ops[0]?.socketID || "";
      otClientRef.current.handleRemoteOps(remoteOps, sourceSocketID);
    }
  }, [opsData, initialSet]);

  // ── Monitor connection status ─────────────────────────────────────────

  useEffect(() => {
    if (opsError) {
      setIsRealtimeReady(false);
      setConnectionStatus("disconnected");
    } else if (opsLoading) {
      setIsRealtimeReady(false);
      setConnectionStatus("syncing");
    } else if (opsData) {
      setConnectionStatus("connected");
    }
  }, [opsError, opsLoading, opsData]);

  // ── Graceful redirect on sustained subscription error ─────────────────
  //
  // Instead of immediately booting the user on any subscription error,
  // start a grace timer. If the error persists for the full grace period,
  // redirect. If the subscription recovers, cancel the timer.

  useEffect(() => {
    if (!opsLoading && opsError) {
      // Start the grace timer if not already running
      if (!errorRedirectTimerRef.current) {
        errorRedirectTimerRef.current = setTimeout(() => {
          errorRedirectTimerRef.current = null;
          location.replace("/app");
        }, SUBSCRIPTION_ERROR_GRACE_MS);
      }
    } else {
      // Subscription recovered or is loading — cancel any pending redirect
      if (errorRedirectTimerRef.current) {
        clearTimeout(errorRedirectTimerRef.current);
        errorRedirectTimerRef.current = null;
      }
    }
  }, [opsLoading, opsError]);

  // Clean up redirect timer on unmount
  useEffect(() => {
    return () => {
      if (errorRedirectTimerRef.current) {
        clearTimeout(errorRedirectTimerRef.current);
        errorRedirectTimerRef.current = null;
      }
    };
  }, []);

  // ── Local change handler ──────────────────────────────────────────────

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      if (isRemoteUpdateRef.current > 0) {
        isRemoteUpdateRef.current--;
        return;
      }

      if (!initialSet) return;
      if (!otClientRef.current?.getSocketID()) return;

      otClientRef.current.handleLocalChange(elements);
    },
    [initialSet],
  );

  return {
    connectionStatus,
    isRealtimeReady,
    initialSet,
    otClientRef,
    isRemoteUpdateRef,
    onChange,
  };
}
