import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import {
  buildElementMap,
  buildElementMapShallow,
  diffElements,
} from "./diffElements";

/** A single operation produced by the client and sent to the server. */
export interface OperationInput {
  clientSeq: number;
  type: "ADD" | "UPDATE" | "DELETE";
  elementID: string;
  elementVer: number;
  baseSeq: number;
  data?: string;
}

/** A remote operation received via subscription or catch-up query. */
export interface RemoteOperation {
  opID: string;
  seq: number;
  clientSeq: number;
  socketID: string;
  type: "ADD" | "UPDATE" | "DELETE";
  elementID: string;
  elementVer: number;
  baseSeq: number;
  data?: string;
  timestamp: string;
}

/** Server response after applying a batch of operations. */
export interface ApplyOpsResult {
  ack: boolean;
  serverSeq: number;
  rejected?: Array<{
    clientSeq: number;
    elementID: string;
    reason: string;
  }> | null;
}

/** Callback type: sends a batch of local ops to the server and returns the result. */
export type SendOpsCallback = (
  ops: OperationInput[],
) => Promise<ApplyOpsResult>;
/** Callback type: applies a new element array to the Excalidraw scene. */
export type UpdateSceneCallback = (
  elements: OrderedExcalidrawElement[],
) => void;
/** Callback type: fetches remote ops after a given server sequence (for catch-up). */
export type FetchOpsSinceCallback = (
  sinceSeq: number,
) => Promise<RemoteOperation[]>;

/**
 * Client-side OT state machine managing:
 * - serverSeq: last acknowledged server sequence
 * - pendingOps: sent to server, awaiting ack
 * - localBuffer: generated locally, not yet sent
 * - elementMap: last known state for diffing
 * - elementOrder: tracks z-ordering of elements
 */
export class OTClient {
  private serverSeq: number = 0;
  private pendingOps: OperationInput[] = [];
  private localBuffer: OperationInput[] = [];
  private elementMap: Map<string, OrderedExcalidrawElement> = new Map();
  /** Tracks element z-ordering. IDs in this array match keys in elementMap. */
  private elementOrder: string[] = [];
  private clientSeqCounter: number = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private socketID: string = "";
  private isFlushing: boolean = false;
  /** Set to true by destroy() — async methods check this to bail out. */
  private destroyed: boolean = false;

  private sendOps: SendOpsCallback;
  private updateScene: UpdateSceneCallback;
  private fetchOpsSince: FetchOpsSinceCallback;

  private flushIntervalMs: number;

  constructor(
    sendOps: SendOpsCallback,
    updateScene: UpdateSceneCallback,
    fetchOpsSince: FetchOpsSinceCallback,
    flushIntervalMs: number = 150,
  ) {
    this.sendOps = sendOps;
    this.updateScene = updateScene;
    this.fetchOpsSince = fetchOpsSince;
    this.flushIntervalMs = flushIntervalMs;
  }

  /** Sets the WebSocket socket ID assigned by the subscription. */
  setSocketID(id: string) {
    this.socketID = id;
  }

  /** Returns the current socket ID. */
  getSocketID(): string {
    return this.socketID;
  }

  /** Returns the last acknowledged server sequence number. */
  getServerSeq(): number {
    return this.serverSeq;
  }

  /**
   * Initialize with the current scene elements (from initial project load).
   * Captures both the element map and z-ordering.
   */
  initializeFromScene(
    elements: readonly OrderedExcalidrawElement[],
    headSeq: number = 0,
  ) {
    this.elementMap = buildElementMap(elements);
    this.elementOrder = elements.map((el) => el.id);
    this.serverSeq = headSeq;
    this.pendingOps = [];
    this.localBuffer = [];
    this.clientSeqCounter = 0;
  }

  /**
   * Called by Excalidraw's onChange handler.
   * Diffs against last known state, produces ops, queues them in localBuffer.
   */
  handleLocalChange(elements: readonly OrderedExcalidrawElement[]) {
    const ops = diffElements(this.elementMap, elements);
    if (ops.length === 0) return;

    // Update element map (shallow — optimised for hot path) and z-ordering
    this.elementMap = buildElementMapShallow(elements);
    this.elementOrder = elements.map((el) => el.id);

    // Convert to OperationInput and add to local buffer
    for (const op of ops) {
      this.clientSeqCounter++;
      this.localBuffer.push({
        clientSeq: this.clientSeqCounter,
        type: op.type,
        elementID: op.elementID,
        elementVer: op.elementVer,
        baseSeq: this.serverSeq,
        data: op.data,
      });
    }

    // Schedule flush
    this.scheduleFlush();
  }

  /**
   * Schedule a flush of local buffer to the server.
   */
  private scheduleFlush() {
    if (this.flushTimer !== null) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Flush local buffer: if no pending ops, send buffer to server.
   * Bails out early if the client has been destroyed.
   */
  private async flush() {
    if (this.destroyed) return;

    if (
      this.isFlushing ||
      this.pendingOps.length > 0 ||
      this.localBuffer.length === 0
    ) {
      // If there are pending ops, wait for ack before sending more
      if (this.localBuffer.length > 0 && this.pendingOps.length > 0) {
        this.scheduleFlush();
      }
      return;
    }

    this.isFlushing = true;
    this.pendingOps = [...this.localBuffer];
    this.localBuffer = [];

    try {
      const result = await this.sendOps(this.pendingOps);

      // Check again after await — client may have been destroyed mid-flight
      if (this.destroyed) return;

      this.serverSeq = result.serverSeq;
      this.pendingOps = [];

      // Handle rejected ops
      if (result.rejected && result.rejected.length > 0) {
        console.warn("OT: Some ops were rejected:", result.rejected);
        // For rejected ops, we should fetch the latest state from remote
        // The subscription will deliver the winning version
      }

      // If more ops buffered during the send, flush again
      if (this.localBuffer.length > 0) {
        this.scheduleFlush();
      }
    } catch (err) {
      if (this.destroyed) return;

      console.error("OT: Failed to send ops:", err);
      // Put pending ops back in buffer for retry
      this.localBuffer = [...this.pendingOps, ...this.localBuffer];
      this.pendingOps = [];
      this.scheduleFlush();
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Handle remote ops received via subscription.
   * Apply them incrementally to the element map, maintain z-ordering,
   * and update the scene.
   */
  handleRemoteOps(ops: RemoteOperation[], fromSocketID: string) {
    if (ops.length === 0) return;

    // Skip if these are our own ops echoed back
    if (fromSocketID === this.socketID) return;

    let sceneChanged = false;

    for (const op of ops) {
      // Update server seq
      if (op.seq > this.serverSeq) {
        this.serverSeq = op.seq;
      }

      switch (op.type) {
        case "ADD":
        case "UPDATE":
          if (op.data) {
            try {
              const element = JSON.parse(op.data) as OrderedExcalidrawElement;
              const isNew = !this.elementMap.has(op.elementID);
              this.elementMap.set(op.elementID, element);
              // New elements go at the end of the z-order
              if (isNew) {
                this.elementOrder.push(op.elementID);
              }
              sceneChanged = true;
            } catch (e) {
              console.error("OT: Failed to parse remote op data:", e);
            }
          }
          break;
        case "DELETE": {
          const existing = this.elementMap.get(op.elementID);
          if (existing) {
            const deleted = {
              ...existing,
              isDeleted: true,
            } as OrderedExcalidrawElement;
            this.elementMap.set(op.elementID, deleted);
            sceneChanged = true;
          }
          break;
        }
      }
    }

    if (sceneChanged) {
      this.updateScene(this.getOrderedElements());
    }
  }

  /**
   * Reconstructs the elements array from the element map, preserving
   * z-ordering tracked by `elementOrder`.
   */
  private getOrderedElements(): OrderedExcalidrawElement[] {
    const elements: OrderedExcalidrawElement[] = [];
    for (const id of this.elementOrder) {
      const el = this.elementMap.get(id);
      if (el) {
        elements.push(el);
      }
    }
    return elements;
  }

  /**
   * Catch up with missed ops after reconnect.
   * Bails out early if the client has been destroyed.
   */
  async catchUp() {
    if (this.destroyed) return;

    try {
      const ops = await this.fetchOpsSince(this.serverSeq);

      if (this.destroyed) return;

      if (ops.length > 0) {
        // Apply all catch-up ops
        for (const op of ops) {
          if (op.seq > this.serverSeq) {
            this.serverSeq = op.seq;
          }

          if (op.socketID === this.socketID) continue; // Skip own ops

          switch (op.type) {
            case "ADD":
            case "UPDATE":
              if (op.data) {
                try {
                  const element = JSON.parse(
                    op.data,
                  ) as OrderedExcalidrawElement;
                  const isNew = !this.elementMap.has(op.elementID);
                  this.elementMap.set(op.elementID, element);
                  if (isNew) {
                    this.elementOrder.push(op.elementID);
                  }
                } catch (e) {
                  console.error("OT: Failed to parse catch-up op data:", e);
                }
              }
              break;
            case "DELETE": {
              const existing = this.elementMap.get(op.elementID);
              if (existing) {
                const deleted = {
                  ...existing,
                  isDeleted: true,
                } as OrderedExcalidrawElement;
                this.elementMap.set(op.elementID, deleted);
              }
              break;
            }
          }
        }

        if (!this.destroyed) {
          this.updateScene(this.getOrderedElements());
        }
      }
    } catch (err) {
      if (!this.destroyed) {
        console.error("OT: Catch-up failed:", err);
      }
    }
  }

  /**
   * Clean up timers and mark the client as destroyed so in-flight
   * async operations bail out.
   */
  destroy() {
    this.destroyed = true;
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
