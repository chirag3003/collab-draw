import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useCallback, useRef, useState } from "react";
import type { OTClient } from "@/lib/ot/OTClient";

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseHistoryModeParams {
  excalidrawApi: ExcalidrawImperativeAPI | null;
  otClientRef: React.RefObject<OTClient | null>;
  isRemoteUpdateRef: React.MutableRefObject<boolean>;
}

interface UseHistoryModeResult {
  /** Whether history mode is currently active. */
  historyMode: boolean;
  /** Toggle history mode on/off. */
  toggleHistoryMode: () => void;
  /** Preview a snapshot — saves current state on first call, then renders the snapshot. */
  handleHistoryPreview: (elements: string) => void;
  /** Restore a snapshot — replaces the scene and re-inits the OTClient. */
  handleHistoryRestore: (elements: string) => void;
  /** Close history mode and revert to the previously saved state. */
  handleHistoryClose: () => void;
}

/**
 * Manages history preview, restore, and close workflows.
 *
 * When the user enters history mode:
 * - The current scene is saved on the first preview.
 * - Subsequent preview calls replace the canvas with a snapshot.
 * - **Restore** re-initialises the OTClient with the snapshot elements.
 * - **Close** reverts to the saved state before history mode was entered.
 */
export function useHistoryMode({
  excalidrawApi,
  otClientRef,
  isRemoteUpdateRef,
}: UseHistoryModeParams): UseHistoryModeResult {
  const [historyMode, setHistoryMode] = useState(false);
  const savedElementsRef = useRef<string | null>(null);

  /** Toggle history mode on/off (used by the History button). */
  const toggleHistoryMode = useCallback(() => {
    setHistoryMode((prev) => !prev);
  }, []);

  /**
   * Preview a historical snapshot. On the first call, saves the live scene
   * so it can be restored later.
   */
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
    [excalidrawApi, isRemoteUpdateRef],
  );

  /**
   * Restore a snapshot: replace the canvas, re-initialise the OTClient at
   * the current serverSeq, and exit history mode.
   */
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
    [excalidrawApi, otClientRef, isRemoteUpdateRef],
  );

  /**
   * Close history mode and revert the canvas to the saved state that was
   * captured when the first preview occurred.
   */
  const handleHistoryClose = useCallback(() => {
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
  }, [excalidrawApi, isRemoteUpdateRef]);

  return {
    historyMode,
    toggleHistoryMode,
    handleHistoryPreview,
    handleHistoryRestore,
    handleHistoryClose,
  };
}
