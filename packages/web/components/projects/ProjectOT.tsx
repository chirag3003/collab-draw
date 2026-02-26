"use client";

import { gql } from "@apollo/client";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  Collaborator,
  SocketId,
} from "@excalidraw/excalidraw/types";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApolloClient } from "@/lib/apolloClient";
import {
  useProjectOpsSubscription,
  useProjectByID,
} from "@/lib/hooks/project";
import {
  useCursorsSubscription,
  useUpdateCursor,
  usePresenceSubscription,
} from "@/lib/hooks/presence";
import { OTClient, type OperationInput, type RemoteOperation } from "@/lib/ot/OTClient";
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
  presenceUsers: Array<{ userID: string; userName: string; status: "ACTIVE" | "IDLE" }>;
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
      <div className={`w-2 h-2 rounded-full ${config.color} ${status === "syncing" ? "animate-pulse" : ""}`} />
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
    rejected: Array<{ clientSeq: number; elementID: string; reason: string }> | null;
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

export default function ProjectOT({ projectID, initialAppState }: ProjectOTProps) {
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [initialSet, setInitialSet] = useState(false);
  const isRemoteUpdateRef = useRef(false);
  const otClientRef = useRef<OTClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "disconnected" | "syncing">("syncing");
  const collaboratorsRef = useRef<Map<SocketId, Collaborator>>(new Map());
  const [presenceUsers, setPresenceUsers] = useState<Array<{ userID: string; userName: string; status: "ACTIVE" | "IDLE" }>>([]);
  const cursorThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const savedElementsRef = useRef<string | null>(null);

  // Fetch initial project data
  const { data: projectData } = useProjectByID(projectID);

  // Subscribe to ops (skip until we have an excalidraw API)
  const {
    data: opsData,
    loading: opsLoading,
    error: opsError,
  } = useProjectOpsSubscription(projectID, !excalidrawApi);

  // Cursor and presence subscriptions
  const { data: cursorData } = useCursorsSubscription(projectID, !excalidrawApi);
  const [updateCursorMutation] = useUpdateCursor();
  const { data: presenceData } = usePresenceSubscription(projectID, !excalidrawApi);

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
      return data!.applyOps;
    };

    const updateScene = (elements: OrderedExcalidrawElement[]) => {
      if (excalidrawApi) {
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements });
      }
    };

    const fetchOpsSince = async (sinceSeq: number): Promise<RemoteOperation[]> => {
      const client = getApolloClient();
      const { data } = await client.query<OpsSinceQueryData>({
        query: OPS_SINCE_QUERY,
        variables: { projectID, sinceSeq },
        fetchPolicy: "network-only",
      });
      return data!.opsSince;
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
      return data!.applyOps;
    };

    const updateScene = (elements: OrderedExcalidrawElement[]) => {
      isRemoteUpdateRef.current = true;
      excalidrawApi.updateScene({ elements });
    };

    const fetchOpsSince = async (sinceSeq: number): Promise<RemoteOperation[]> => {
      const client = getApolloClient();
      const { data } = await client.query<OpsSinceQueryData>({
        query: OPS_SINCE_QUERY,
        variables: { projectID, sinceSeq },
        fetchPolicy: "network-only",
      });
      return data!.opsSince;
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
    if (!excalidrawApi || !projectData?.project || initialSet) return;

    try {
      let toParse = projectData.project.elements || "[]";
      if (toParse.trim() === "") toParse = "[]";
      const elements = JSON.parse(toParse) as OrderedExcalidrawElement[];

      isRemoteUpdateRef.current = true;
      excalidrawApi.updateScene({ elements });

      if (otClientRef.current) {
        otClientRef.current.initializeFromScene(elements);
      }
      setInitialSet(true);
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
      setConnectionStatus("connected");
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

  // Handle cursor subscription data - update collaborators
  useEffect(() => {
    if (!cursorData?.cursors) return;

    const cursor = cursorData.cursors;
    // Convert string[] to Record<string, true> as Excalidraw expects
    const selectedIds: Record<string, true> = {};
    for (const id of cursor.selectedElementIds || []) {
      selectedIds[id] = true;
    }
    collaboratorsRef.current.set(cursor.userID as SocketId, {
      username: cursor.userName,
      color: { background: cursor.color, stroke: cursor.color },
      pointer: { x: cursor.x, y: cursor.y, tool: "laser" },
      selectedElementIds: selectedIds,
      isCurrentUser: false,
    });
    // Push collaborators into Excalidraw via updateScene
    if (excalidrawApi) {
      isRemoteUpdateRef.current = true;
      excalidrawApi.updateScene({
        collaborators: new Map(collaboratorsRef.current),
      });
    }
  }, [cursorData]);

  // Handle presence updates
  useEffect(() => {
    if (!presenceData?.presence) return;
    setPresenceUsers(presenceData.presence);
  }, [presenceData]);

  // Monitor connection status
  useEffect(() => {
    if (opsError) {
      setConnectionStatus("disconnected");
    } else if (opsLoading) {
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

  // Send cursor position (throttled to ~10Hz)
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: string }) => {
      if (cursorThrottleRef.current) return;

      cursorThrottleRef.current = setTimeout(() => {
        cursorThrottleRef.current = null;
      }, 100);

      const selectedIds = excalidrawApi
        ? Object.keys(excalidrawApi.getAppState().selectedElementIds || {})
        : [];

      updateCursorMutation({
        variables: {
          projectID,
          cursor: {
            x: payload.pointer.x,
            y: payload.pointer.y,
            selectedElementIds: selectedIds,
          },
        },
      }).catch(() => {}); // Cursor updates are best-effort
    },
    [projectID, updateCursorMutation, excalidrawApi],
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
        savedElementsRef.current = JSON.stringify(excalidrawApi.getSceneElements());
      }
      try {
        const parsed = JSON.parse(elements || "[]") as OrderedExcalidrawElement[];
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
        const parsed = JSON.parse(elements || "[]") as OrderedExcalidrawElement[];
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements: parsed });
        // Re-initialize OT client with restored state
        otClientRef.current.initializeFromScene(parsed, otClientRef.current.getServerSeq());
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
        const parsed = JSON.parse(savedElementsRef.current) as OrderedExcalidrawElement[];
        isRemoteUpdateRef.current = true;
        excalidrawApi.updateScene({ elements: parsed });
      } catch (e) {
        console.error("Failed to restore saved state:", e);
      }
    }
    savedElementsRef.current = null;
    setHistoryMode(false);
  }, [excalidrawApi]);

  // Cleanup cursor throttle
  useEffect(() => {
    return () => {
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <ConnectionStatus status={connectionStatus} presenceUsers={presenceUsers} />

      {/* History toggle button */}
      <button
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
        onPointerUpdate={historyMode ? undefined : handlePointerUpdate}
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
