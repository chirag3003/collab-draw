"use client";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  useCursorsSubscription,
  usePresenceSubscription,
} from "@/lib/hooks/presence";
import { useCursorManager } from "@/lib/hooks/useCursorManager";
import { useOTSync } from "@/lib/hooks/useOTSync";
import ConnectionStatus from "./ConnectionStatus";

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
  initialAppState: AppState | null;
}

/**
 * Top-level orchestrator for the collaborative Excalidraw canvas.
 *
 * Composes three domain hooks:
 * - {@link useOTSync} — OT lifecycle, subscriptions, connection status
 * - {@link useCursorManager} — outgoing cursor throttle + incoming cursor lerp
 *
 * This component itself contains only the Excalidraw render, a thin
 * `onChange` bridge, presence wiring, and layout chrome.
 */
export default function ProjectOT({
  projectID,
  initialAppState,
}: ProjectOTProps) {
  const { user } = useAuth();
  const [excalidrawApi, setExcalidrawApi] =
    useState<ExcalidrawImperativeAPI | null>(null);

  // ── OT synchronisation ─────────────────────────────────────────────────

  const { connectionStatus, isRealtimeReady, onChange } = useOTSync({
    projectID,
    excalidrawApi,
  });

  // ── Cursor management ──────────────────────────────────────────────────

  const { handleCursorEvent, handlePointerUpdate } = useCursorManager({
    projectID,
    excalidrawApi,
    currentUserID: user?.id,
  });

  // ── Presence ───────────────────────────────────────────────────────────

  useCursorsSubscription(projectID, !excalidrawApi, handleCursorEvent);
  const { data: presenceData } = usePresenceSubscription(
    projectID,
    !excalidrawApi,
  );
  const presenceUsers = presenceData?.presence ?? [];

  // ── Cookie persistence for appState (throttled to ~once/2s) ─────────────

  /** Interval (ms) between cookie writes for appState. */
  const APP_STATE_THROTTLE_MS = 2_000;
  const appStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAppStateRef = useRef<AppState | null>(null);

  const setAppState = useCallback(
    (appState: AppState) => {
      latestAppStateRef.current = appState;
      if (appStateTimerRef.current) return; // already scheduled

      appStateTimerRef.current = setTimeout(() => {
        appStateTimerRef.current = null;
        if (latestAppStateRef.current) {
          Cookies.set(
            `appState_${projectID}`,
            JSON.stringify(latestAppStateRef.current),
          );
        }
      }, APP_STATE_THROTTLE_MS);
    },
    [projectID],
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full relative">
      <ConnectionStatus
        status={connectionStatus}
        presenceUsers={presenceUsers}
      />

      <Excalidraw
        initialData={{
          appState: initialAppState ?? undefined,
        }}
        excalidrawAPI={(api) => {
          setExcalidrawApi(api);
        }}
        onChange={(elements, appState) => {
          onChange(elements);
          setAppState(appState);
        }}
        onPointerUpdate={!isRealtimeReady ? undefined : handlePointerUpdate}
        viewModeEnabled={!isRealtimeReady}
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

      {!isRealtimeReady && (
        <div className="absolute inset-0 z-40 bg-white/35 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-md bg-white/90 border border-gray-200 text-sm font-medium text-gray-700 shadow">
            Connecting realtime sync...
          </div>
        </div>
      )}
    </div>
  );
}
