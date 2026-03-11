import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef } from "react";
import { useUpdateCursor } from "@/lib/hooks/presence";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Minimum interval (ms) between outgoing cursor position broadcasts (~15 Hz). */
const CURSOR_SEND_INTERVAL_MS = 66;
/** If no pointer movement for this many ms, stop the send interval. */
const CURSOR_IDLE_STOP_MS = 220;
/** Interpolation factor for lerp-smoothing remote cursors each frame. */
const CURSOR_LERP_ALPHA = 0.35;
/** Below this distance (canvas units) a cursor snaps to its target position. */
const CURSOR_SNAP_DISTANCE = 0.5;

// ─── Internal Types ──────────────────────────────────────────────────────────

/** Mutable interpolation state for a single remote cursor. */
interface RemoteCursorState {
  username: string;
  color: string;
  selectedElementIds: Record<string, true>;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
}

/** Incoming cursor event payload from the cursors subscription. */
interface CursorEventPayload {
  userID: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  selectedElementIds: string[];
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseCursorManagerParams {
  projectID: string;
  excalidrawApi: ExcalidrawImperativeAPI | null;
  currentUserID: string | undefined;
}

/**
 * Manages outgoing cursor broadcasts and incoming remote cursor animations.
 *
 * **Outgoing** — throttles the local pointer position to ~15 Hz via a
 * trailing-edge interval. When the user goes idle for
 * {@link CURSOR_IDLE_STOP_MS} ms the interval is cleared.
 *
 * **Incoming** — maintains a `Map<SocketId, RemoteCursorState>` that tracks
 * each remote user's interpolated position. A `requestAnimationFrame` loop
 * lerp-smooths positions toward their targets every frame and calls
 * `excalidrawApi.updateScene({ collaborators })` to render them.
 *
 * @returns An object with:
 *  - `handleCursorEvent` — pass to the cursors subscription `onCursor` callback.
 *  - `handlePointerUpdate` — pass to Excalidraw's `onPointerUpdate` prop.
 */
export function useCursorManager({
  projectID,
  excalidrawApi,
  currentUserID,
}: UseCursorManagerParams) {
  const collaboratorsRef = useRef<Map<SocketId, Collaborator>>(new Map());
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
  const remoteCursorStateRef = useRef<Map<SocketId, RemoteCursorState>>(
    new Map(),
  );

  const [updateCursorMutation] = useUpdateCursor();

  // ── Flush collaborators map into Excalidraw ──────────────────────────────

  /**
   * Pushes the current collaborators map to Excalidraw.
   * Sets `isRemoteUpdateRef` via the returned flag mechanism (handled by caller).
   */
  const flushCollaborators = useCallback(() => {
    if (!excalidrawApi) return;
    excalidrawApi.updateScene({
      collaborators: new Map(collaboratorsRef.current),
    });
  }, [excalidrawApi]);

  // ── RAF animation loop ───────────────────────────────────────────────────

  /**
   * Single frame of cursor animation: lerp each remote cursor toward its
   * target, update the collaborators map, and schedule the next frame if
   * any cursor is still moving.
   */
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

  /** Kick-starts the RAF loop if it is not already running. */
  const startCursorAnimation = useCallback(() => {
    if (cursorAnimationRafRef.current !== null) return;
    cursorAnimationRafRef.current = requestAnimationFrame(stepCursorAnimation);
  }, [stepCursorAnimation]);

  // ── Outgoing cursor throttle ─────────────────────────────────────────────

  /**
   * Fires on each send-interval tick: if a new cursor payload has been
   * buffered, sends it via the `updateCursor` mutation. If the user has
   * gone idle, clears the interval.
   */
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
    }).catch((err: unknown) => {
      console.debug("Cursor update failed (transient):", err);
    });
  }, [projectID, updateCursorMutation]);

  /** Lazily starts the send interval if it is not already running. */
  const ensureCursorSender = useCallback(() => {
    if (cursorSendIntervalRef.current) return;
    cursorSendIntervalRef.current = setInterval(
      sendLatestCursor,
      CURSOR_SEND_INTERVAL_MS,
    );
  }, [sendLatestCursor]);

  // ── Incoming cursor handler ──────────────────────────────────────────────

  /**
   * Processes a remote cursor event: upserts the interpolation state for the
   * given user and starts the RAF animation loop if needed.
   *
   * Ignores events from the current user.
   */
  const handleCursorEvent = useCallback(
    (cursor: CursorEventPayload | null | undefined) => {
      if (!cursor) return;
      if (currentUserID && cursor.userID === currentUserID) return;

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
    [startCursorAnimation, currentUserID],
  );

  // ── Outgoing pointer handler ─────────────────────────────────────────────

  /**
   * Excalidraw `onPointerUpdate` handler.
   * Buffers the latest pointer position and starts the send interval.
   */
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

  // ── Cleanup ──────────────────────────────────────────────────────────────

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

  return { handleCursorEvent, handlePointerUpdate };
}
