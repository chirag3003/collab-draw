"use client";

import { gql } from "@apollo/client";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApolloClient } from "@/lib/apolloClient";
import { useAuth } from "@/lib/auth/context";
import {
  useCursorsSubscription,
  usePresenceSubscription,
  useUpdateCursor,
} from "@/lib/hooks/presence";
import { useProjectByID, useProjectOpsSubscription } from "@/lib/hooks/project";
import {
  type OperationInput,
  OTClient,
  type RemoteOperation,
} from "@/lib/ot/OTClient";
import HistoryTimeline from "./HistoryTimeline";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading drawing canvas...</p>
        </div>
      </div>
    ),
  },
);

interface ProjectOTProps {
  projectID: string;
  initialAppState: AppState;
}

// Connection status + presence component
function ConnectionStatus({
  status,
  presenceUsers,
}: {
  status: "connected" | "disconnected" | "syncing";
  presenceUsers: Array<{
    userID: string;
    userName: string;
    status: "ACTIVE" | "IDLE";
  }>;
}) {
  const statusConfig = {
    connected: { color: "bg-green-500", text: "Connected" },
    syncing: { color: "bg-yellow-500", text: "Syncing..." },
    disconnected: { color: "bg-red-500", text: "Disconnected" },
  };

  const config = statusConfig[status];

  return (
    <div className="absolute top-4 right-4 z-50 flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-gray-200">
      {presenceUsers.length > 0 && (
        <div className="flex -space-x-2 mr-2">
          {presenceUsers.slice(0, 5).map((user) => (
            <div
              key={user.userID}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-white ${user.status === "IDLE" ? "opacity-50" : ""}`}
              style={{ backgroundColor: userIDToColor(user.userID) }}
              title={`${user.userName}${user.status === "IDLE" ? " (idle)" : ""}`}
            >
              {user.userName.charAt(0).toUpperCase()}
            </div>
          ))}
          {presenceUsers.length > 5 && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600 bg-gray-200 border-2 border-white">
              +{presenceUsers.length - 5}
            </div>
          )}
        </div>
      )}
      <div
        className={`w-2 h-2 rounded-full ${config.color} ${status === "syncing" ? "animate-pulse" : ""}`}
      />
      <span className="text-sm font-medium text-gray-700">{config.text}</span>
    </div>
  );
}

function userIDToColor(userID: string): string {
  let hash = 0;
  for (let i = 0; i < userID.length; i++) {
    hash = ((hash << 5) - hash + userID.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

interface ApplyOpsMutationData {
  applyOps: {
    ack: boolean;
    serverSeq: number;
    rejected: Array<{
      clientSeq: number;
      elementID: string;
      reason: string;
    }> | null;
  };
}

interface OpsSinceQueryData {
  opsSince: RemoteOperation[];
}

const APPLY_OPS_MUTATION = gql`
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

const OPS_SINCE_QUERY = gql`
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

const CURSOR_SEND_INTERVAL_MS = 66;
const CURSOR_IDLE_STOP_MS = 220;
const CURSOR_LERP_ALPHA = 0.35;
const CURSOR_SNAP_DISTANCE = 0.5;

export default function ProjectOT({
  projectID,
  initialAppState,
}: ProjectOTProps) {
  const { user } = useAuth();
  const [excalidrawApi, setExcalidrawApi] =
    useState<ExcalidrawImperativeAPI | null>(null);
  const [initialSet, setInitialSet] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const otClientRef = useRef<OTClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "syncing"
  >("syncing");
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const collaboratorsRef = useRef<Map<SocketId, Collaborator>>(new Map());
  const [presenceUsers, setPresenceUsers] = useState<
    Array<{ userID: string; userName: string; status: "ACTIVE" | "IDLE" }>
  >([]);
  const cursorAnimationRafRef = useRef<number | null>(null);
  const cursorSendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const lastCursorMoveAtRef = useRef(0);
  const latestCursorPayloadRef = useRef<{
    x: number;
    y: number;
    selectedElementIds: string[];
  } | null>(null);
  const remoteCursorStateRef = useRef<
    Map<
      SocketId,
      {
        username: string;
        color: string;
        selectedElementIds: Record<string, true>;
        currentX: number;
        currentY: number;
        targetX: number;
        targetY: number;
      }
    >
  >(new Map());
  const [historyMode, setHistoryMode] = useState(false);
  const savedElementsRef = useRef<string | null>(null);
  const initialElementsAppliedRef = useRef<string | null>(null);
  const hasCaughtUpRef = useRef(false);
  const [updateCursorMutation] = useUpdateCursor();

  useEffect(() => {
    if (!projectID) return;
    setInitialSet(false);
    setIsRealtimeReady(false);
    initialElementsAppliedRef.current = null;
    hasCaughtUpRef.current = false;
  }, [projectID]);

  const flushCollaborators = useCallback(() => {
    if (!excalidrawApi) return;
    isRemoteUpdateRef.current = true;
    excalidrawApi.updateScene({
      collaborators: new Map(collaboratorsRef.current),
    });
  }, [excalidrawApi]);

  const stepCursorAnimation = useCallback(() => {
    let hasMovingCursor = false;

    for (const [socketID, state] of remoteCursorStateRef.current) {
      const dx = state.targetX - state.currentX;
      const dy = state.targetY - state.currentY;
      const distance = Math.hypot(dx, dy);

      if (distance > CURSOR_SNAP_DISTANCE) {
        state.currentX += dx * CURSOR_LERP_ALPHA;
        state.currentY += dy * CURSOR_LERP_ALPHA;
        hasMovingCursor = true;
      } else {
        state.currentX = state.targetX;
        state.currentY = state.targetY;
      }

      collaboratorsRef.current.set(socketID, {
        username: state.username,
        color: { background: state.color, stroke: state.color },
        pointer: { x: state.currentX, y: state.currentY, tool: "laser" },
        selectedElementIds: state.selectedElementIds,
        isCurrentUser: false,
      });
    }

    flushCollaborators();

    if (hasMovingCursor) {
      cursorAnimationRafRef.current =
        requestAnimationFrame(stepCursorAnimation);
      return;
    }

    cursorAnimationRafRef.current = null;
  }, [flushCollaborators]);

  const startCursorAnimation = useCallback(() => {
    if (cursorAnimationRafRef.current !== null) return;
    cursorAnimationRafRef.current = requestAnimationFrame(stepCursorAnimation);
  }, [stepCursorAnimation]);

  const sendLatestCursor = useCallback(() => {
    const latest = latestCursorPayloadRef.current;
    if (!latest) {
      if (
        cursorSendIntervalRef.current &&
        Date.now() - lastCursorMoveAtRef.current > CURSOR_IDLE_STOP_MS
      ) {
        clearInterval(cursorSendIntervalRef.current);
        cursorSendIntervalRef.current = null;
      }
      return;
    }

    latestCursorPayloadRef.current = null;

    updateCursorMutation({
      variables: {
        projectID,
        cursor: {
          x: latest.x,
          y: latest.y,
          selectedElementIds: latest.selectedElementIds,
        },
      },
    }).catch(() => {});
  }, [projectID, updateCursorMutation]);

  const ensureCursorSender = useCallback(() => {
    if (cursorSendIntervalRef.current) return;
    cursorSendIntervalRef.current = setInterval(
      sendLatestCursor,
      CURSOR_SEND_INTERVAL_MS,
    );
  }, [sendLatestCursor]);

  const handleCursorEvent = useCallback(
    (
      cursor:
        | {
            userID: string;
            userName: string;
            color: string;
            x: number;
            y: number;
            selectedElementIds: string[];
          }
        | null
        | undefined,
    ) => {
      if (!cursor) return;
      if (user?.id && cursor.userID === user.id) return;

      const selectedIds: Record<string, true> = {};
      for (const id of cursor.selectedElementIds || []) {
        selectedIds[id] = true;
      }

      const socketID = cursor.userID as SocketId;
      const existing = remoteCursorStateRef.current.get(socketID);

      if (existing) {
        existing.username = cursor.userName;
        existing.color = cursor.color;
        existing.selectedElementIds = selectedIds;
        existing.targetX = cursor.x;
        existing.targetY = cursor.y;
      } else {
        remoteCursorStateRef.current.set(socketID, {
          username: cursor.userName,
          color: cursor.color,
          selectedElementIds: selectedIds,
          currentX: cursor.x,
          currentY: cursor.y,
          targetX: cursor.x,
          targetY: cursor.y,
        });
      }

      startCursorAnimation();
    },
    [startCursorAnimation, user?.id],
  );

  // Fetch initial project data
  const { data: projectData } = useProjectByID(projectID);

  // Subscribe to ops (skip until we have an excalidraw API)
  const {
    data: opsData,
    loading: opsLoading,
    error: opsError,
  } = useProjectOpsSubscription(projectID, !excalidrawApi);

  // Cursor and presence subscriptions
  useCursorsSubscription(projectID, !excalidrawApi, handleCursorEvent);
  const { data: presenceData } = usePresenceSubscription(
    projectID,
    !excalidrawApi,
  );

  // Initialize OT client
  useEffect(() => {
    if (otClientRef.current) return;

    const sendOps = async (ops: OperationInput[]) => {
      const client = getApolloClient();
      const socketID = otClientRef.current?.getSocketID() || "";
      const { data } = await client.mutate<ApplyOpsMutationData>({
        mutation: APPLY_OPS_MUTATION,
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
      if (excalidrawApi) {
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements });
      }
    };

    const fetchOpsSince = async (
      sinceSeq: number,
    ): Promise<RemoteOperation[]> => {
      const client = getApolloClient();
      const { data } = await client.query<OpsSinceQueryData>({
        query: OPS_SINCE_QUERY,
        variables: { projectID, sinceSeq },
        fetchPolicy: "network-only",
      });
      return data?.opsSince ?? [];
    };

    otClientRef.current = new OTClient(sendOps, updateScene, fetchOpsSince);

    return () => {
      otClientRef.current?.destroy();
      otClientRef.current = null;
    };
  }, [projectID, excalidrawApi]);

  // Update the OT client's updateScene callback when excalidrawApi changes
  useEffect(() => {
    if (!otClientRef.current || !excalidrawApi) return;

    const currentOT = otClientRef.current;
    const savedSocketID = currentOT.getSocketID();
    const savedServerSeq = currentOT.getServerSeq();

    const sendOps = async (ops: OperationInput[]) => {
      const client = getApolloClient();
      const socketID = otClientRef.current?.getSocketID() || "";
      const { data } = await client.mutate<ApplyOpsMutationData>({
        mutation: APPLY_OPS_MUTATION,
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
      isRemoteUpdateRef.current = true;
      excalidrawApi.updateScene({ elements });
    };

    const fetchOpsSince = async (
      sinceSeq: number,
    ): Promise<RemoteOperation[]> => {
      const client = getApolloClient();
      const { data } = await client.query<OpsSinceQueryData>({
        query: OPS_SINCE_QUERY,
        variables: { projectID, sinceSeq },
        fetchPolicy: "network-only",
      });
      return data?.opsSince ?? [];
    };

    currentOT.destroy();
    const newOT = new OTClient(sendOps, updateScene, fetchOpsSince);
    newOT.setSocketID(savedSocketID);

    if (initialSet) {
      const elements = excalidrawApi.getSceneElements();
      newOT.initializeFromScene(elements, savedServerSeq);
    }

    otClientRef.current = newOT;
  }, [excalidrawApi, projectID, initialSet]);

  // Handle initial project load - set scene elements
  useEffect(() => {
    if (!excalidrawApi || !projectData?.project) return;

    try {
      let toParse = projectData.project.elements || "[]";
      if (toParse.trim() === "") toParse = "[]";

      if (initialSet && initialElementsAppliedRef.current === toParse) {
        return;
      }

      const elements = JSON.parse(toParse) as OrderedExcalidrawElement[];

      isRemoteUpdateRef.current = true;
      excalidrawApi.updateScene({ elements });

      if (otClientRef.current) {
        otClientRef.current.initializeFromScene(elements);
      }

      initialElementsAppliedRef.current = toParse;
      if (!initialSet) {
        setInitialSet(true);
      }
    } catch (error) {
      console.error("Failed to parse initial elements:", error);
      setInitialSet(true);
    }
  }, [excalidrawApi, projectData, initialSet]);

  // Handle subscription data - set socketID and process remote ops
  useEffect(() => {
    if (!opsData?.projectOps || !otClientRef.current) return;

    const { ops, socketID: subSocketID } = opsData.projectOps;

    // First message: capture socketID
    if (!otClientRef.current.getSocketID() && subSocketID) {
      otClientRef.current.setSocketID(subSocketID);
      setIsRealtimeReady(true);
      setConnectionStatus("connected");
      if (!hasCaughtUpRef.current) {
        hasCaughtUpRef.current = true;
        void otClientRef.current.catchUp();
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
  }, [opsData]);

  // Handle presence updates
  useEffect(() => {
    if (!presenceData?.presence) return;
    setPresenceUsers(presenceData.presence);
  }, [presenceData]);

  // Monitor connection status
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

  // Handle subscription errors - redirect if no access
  useEffect(() => {
    if (!opsLoading && opsError) {
      location.replace("/app");
    }
  }, [opsLoading, opsError]);

  const onChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[]) => {
      // Skip remote update echoes
      if (isRemoteUpdateRef.current) {
        isRemoteUpdateRef.current = false;
        return;
      }

      if (!initialSet) return;
      if (!otClientRef.current?.getSocketID()) return;

      otClientRef.current.handleLocalChange(elements);
    },
    [initialSet],
  );

  // Send cursor position using trailing throttle (~15Hz)
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: string }) => {
      const selectedIds = excalidrawApi
        ? Object.keys(excalidrawApi.getAppState().selectedElementIds || {})
        : [];

      lastCursorMoveAtRef.current = Date.now();
      latestCursorPayloadRef.current = {
        x: payload.pointer.x,
        y: payload.pointer.y,
        selectedElementIds: selectedIds,
      };
      ensureCursorSender();
    },
    [ensureCursorSender, excalidrawApi],
  );

  function setAppState(appState: AppState) {
    Cookies.set(`appState_${projectID}`, JSON.stringify(appState));
  }

  // History mode handlers
  const handleHistoryPreview = useCallback(
    (elements: string) => {
      if (!excalidrawApi) return;
      // Save current state on first preview
      if (!savedElementsRef.current) {
        savedElementsRef.current = JSON.stringify(
          excalidrawApi.getSceneElements(),
        );
      }
      try {
        const parsed = JSON.parse(
          elements || "[]",
        ) as OrderedExcalidrawElement[];
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements: parsed });
      } catch (e) {
        console.error("Failed to preview history:", e);
      }
    },
    [excalidrawApi],
  );

  const handleHistoryRestore = useCallback(
    (elements: string) => {
      if (!excalidrawApi || !otClientRef.current) return;
      try {
        const parsed = JSON.parse(
          elements || "[]",
        ) as OrderedExcalidrawElement[];
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements: parsed });
        // Re-initialize OT client with restored state
        otClientRef.current.initializeFromScene(
          parsed,
          otClientRef.current.getServerSeq(),
        );
        savedElementsRef.current = null;
        setHistoryMode(false);
      } catch (e) {
        console.error("Failed to restore history:", e);
      }
    },
    [excalidrawApi],
  );

  const handleHistoryClose = useCallback(() => {
    // Restore the saved state
    if (savedElementsRef.current && excalidrawApi) {
      try {
        const parsed = JSON.parse(
          savedElementsRef.current,
        ) as OrderedExcalidrawElement[];
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements: parsed });
      } catch (e) {
        console.error("Failed to restore saved state:", e);
      }
    }
    savedElementsRef.current = null;
    setHistoryMode(false);
  }, [excalidrawApi]);

  // Cleanup cursor timers and animation frame
  useEffect(() => {
    return () => {
      if (cursorSendIntervalRef.current) {
        clearInterval(cursorSendIntervalRef.current);
      }
      if (cursorAnimationRafRef.current !== null) {
        cancelAnimationFrame(cursorAnimationRafRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <ConnectionStatus
        status={connectionStatus}
        presenceUsers={presenceUsers}
      />

      {/* History toggle button */}
      <button
        type="button"
        onClick={() => setHistoryMode((prev) => !prev)}
        className="absolute top-4 left-4 z-50 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
        title="View history"
      >
        History
      </button>

      <Excalidraw
        initialData={{
          appState: initialAppState,
        }}
        excalidrawAPI={(api) => {
          setExcalidrawApi(api);
        }}
        onChange={(elements, appState) => {
          if (!historyMode) {
            onChange(elements);
            setAppState(appState);
          }
        }}
        onPointerUpdate={
          historyMode || !isRealtimeReady ? undefined : handlePointerUpdate
        }
        viewModeEnabled={!historyMode && !isRealtimeReady}
        UIOptions={{
          canvasActions: {
            toggleTheme: true,
            saveToActiveFile: false,
            export: {
              saveFileToDisk: true,
            },
          },
        }}
      />

      {!historyMode && !isRealtimeReady && (
        <div className="absolute inset-0 z-40 bg-white/35 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-md bg-white/90 border border-gray-200 text-sm font-medium text-gray-700 shadow">
            Connecting realtime sync...
          </div>
        </div>
      )}

      {historyMode && (
        <HistoryTimeline
          projectID={projectID}
          currentSeq={otClientRef.current?.getServerSeq() || 0}
          onPreview={handleHistoryPreview}
          onRestore={handleHistoryRestore}
          onClose={handleHistoryClose}
        />
      )}
    </div>
  );
}
