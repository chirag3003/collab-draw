import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

export type OpType = "ADD" | "UPDATE" | "DELETE";

export interface ElementOp {
  type: OpType;
  elementID: string;
  elementVer: number;
  data?: string; // JSON-serialized element data
}

/**
 * Compares previous element map vs current elements array and produces
 * ADD, UPDATE, DELETE operations.
 *
 * Excalidraw uses soft-delete (isDeleted: true), so a transition to
 * isDeleted is detected as a DELETE op.
 */
export function diffElements(
  prevMap: Map<string, OrderedExcalidrawElement>,
  current: readonly OrderedExcalidrawElement[],
): ElementOp[] {
  const ops: ElementOp[] = [];
  const seenIDs = new Set<string>();

  for (const el of current) {
    seenIDs.add(el.id);
    const prev = prevMap.get(el.id);

    if (!prev) {
      // New element
      if (!el.isDeleted) {
        ops.push({
          type: "ADD",
          elementID: el.id,
          elementVer: el.version,
          data: JSON.stringify(el),
        });
      }
    } else if (el.version !== prev.version) {
      // Element was modified
      if (el.isDeleted && !prev.isDeleted) {
        // Soft-delete transition
        ops.push({
          type: "DELETE",
          elementID: el.id,
          elementVer: el.version,
        });
      } else {
        ops.push({
          type: "UPDATE",
          elementID: el.id,
          elementVer: el.version,
          data: JSON.stringify(el),
        });
      }
    }
  }

  // Elements that were in prevMap but not in current → hard delete
  for (const [id, prev] of prevMap) {
    if (!seenIDs.has(id) && !prev.isDeleted) {
      ops.push({
        type: "DELETE",
        elementID: id,
        elementVer: prev.version,
      });
    }
  }

  return ops;
}

/**
 * Builds an element map from an element array, keyed by element ID.
 */
export function buildElementMap(
  elements: readonly OrderedExcalidrawElement[],
): Map<string, OrderedExcalidrawElement> {
  return new Map(elements.map((el) => [el.id, el]));
}
