import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { diffElements, buildElementMap, type ElementOp } from "./diffElements";

export interface OperationInput {
  clientSeq: number;
  type: "ADD" | "UPDATE" | "DELETE";
  elementID: string;
  elementVer: number;
  baseSeq: number;
  data?: string;
}

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

export interface ApplyOpsResult {
  ack: boolean;
  serverSeq: number;
  rejected?: Array<{
    clientSeq: number;
    elementID: string;
    reason: string;
  }> | null;
}

export type SendOpsCallback = (ops: OperationInput[]) => Promise<ApplyOpsResult>;
export type UpdateSceneCallback = (elements: OrderedExcalidrawElement[]) => void;
export type FetchOpsSinceCallback = (sinceSeq: number) => Promise<RemoteOperation[]>;

/**
 * Client-side OT state machine managing:
 * - serverSeq: last acknowledged server sequence
 * - pendingOps: sent to server, awaiting ack
 * - localBuffer: generated locally, not yet sent
 * - elementMap: last known state for diffing
 */
export class OTClient {
  private serverSeq: number = 0;
  private pendingOps: OperationInput[] = [];
  private localBuffer: OperationInput[] = [];
  private elementMap: Map<string, OrderedExcalidrawElement> = new Map();
  private clientSeqCounter: number = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private socketID: string = "";
  private isFlushing: boolean = false;

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

  setSocketID(id: string) {
    this.socketID = id;
  }

  getSocketID(): string {
    return this.socketID;
  }

  getServerSeq(): number {
    return this.serverSeq;
  }

  /**
   * Initialize with the current scene elements (from initial project load).
   */
  initializeFromScene(elements: readonly OrderedExcalidrawElement[], headSeq: number = 0) {
    this.elementMap = buildElementMap(elements);
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

    // Update element map to reflect new state
    this.elementMap = buildElementMap(elements);

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
   */
  private async flush() {
    if (this.isFlushing || this.pendingOps.length > 0 || this.localBuffer.length === 0) {
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
   * Apply them incrementally to the element map and update the scene.
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
              this.elementMap.set(op.elementID, element);
              sceneChanged = true;
            } catch (e) {
              console.error("OT: Failed to parse remote op data:", e);
            }
          }
          break;
        case "DELETE":
          if (this.elementMap.has(op.elementID)) {
            const existing = this.elementMap.get(op.elementID)!;
            // Apply soft-delete
            const deleted = { ...existing, isDeleted: true } as OrderedExcalidrawElement;
            this.elementMap.set(op.elementID, deleted);
            sceneChanged = true;
          }
          break;
      }
    }

    if (sceneChanged) {
      // Reconstruct elements array from map
      const elements = Array.from(this.elementMap.values());
      this.updateScene(elements);
    }
  }

  /**
   * Catch up with missed ops after reconnect.
   */
  async catchUp() {
    try {
      const ops = await this.fetchOpsSince(this.serverSeq);
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
                  const element = JSON.parse(op.data) as OrderedExcalidrawElement;
                  this.elementMap.set(op.elementID, element);
                } catch (e) {
                  console.error("OT: Failed to parse catch-up op data:", e);
                }
              }
              break;
            case "DELETE":
              if (this.elementMap.has(op.elementID)) {
                const existing = this.elementMap.get(op.elementID)!;
                const deleted = { ...existing, isDeleted: true } as OrderedExcalidrawElement;
                this.elementMap.set(op.elementID, deleted);
              }
              break;
          }
        }

        const elements = Array.from(this.elementMap.values());
        this.updateScene(elements);
      }
    } catch (err) {
      console.error("OT: Catch-up failed:", err);
    }
  }

  /**
   * Clean up timers.
   */
  destroy() {
    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
