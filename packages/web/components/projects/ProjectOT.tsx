"use client";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import Cookies from "js-cookie";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import {
  useCursorsSubscription,
  usePresenceSubscription,
} from "@/lib/hooks/presence";
import { useCursorManager } from "@/lib/hooks/useCursorManager";
import { useHistoryMode } from "@/lib/hooks/useHistoryMode";
import { useOTSync } from "@/lib/hooks/useOTSync";
import ConnectionStatus from "./ConnectionStatus";
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

/**
 * Top-level orchestrator for the collaborative Excalidraw canvas.
 *
 * Composes three domain hooks:
 * - {@link useOTSync} — OT lifecycle, subscriptions, connection status
 * - {@link useCursorManager} — outgoing cursor throttle + incoming cursor lerp
 * - {@link useHistoryMode} — history preview / restore / close
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

  const {
    connectionStatus,
    isRealtimeReady,
    otClientRef,
    isRemoteUpdateRef,
    onChange,
  } = useOTSync({ projectID, excalidrawApi });

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

  // ── History mode ───────────────────────────────────────────────────────

  const {
    historyMode,
    toggleHistoryMode,
    handleHistoryPreview,
    handleHistoryRestore,
    handleHistoryClose,
  } = useHistoryMode({ excalidrawApi, otClientRef, isRemoteUpdateRef });

  // ── Cookie persistence for appState ────────────────────────────────────

  function setAppState(appState: AppState) {
    Cookies.set(`appState_${projectID}`, JSON.stringify(appState));
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full relative">
      <ConnectionStatus
        status={connectionStatus}
        presenceUsers={presenceUsers}
      />

      {/* History toggle button */}
      <button
        type="button"
        onClick={toggleHistoryMode}
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
