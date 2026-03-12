import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";

/** The type of element operation: add, update, or soft-delete. */
export type OpType = "ADD" | "UPDATE" | "DELETE";

/** A single element-level operation produced by {@link diffElements}. */
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
 * Each element is deep-cloned to prevent mutation of the map's entries.
 *
 * Used for initial scene load and remote updates where deep isolation
 * is desired.
 *
 * @param elements - The source elements to index.
 * @returns A new `Map<id, element>` with cloned values.
 */
export function buildElementMap(
  elements: readonly OrderedExcalidrawElement[],
): Map<string, OrderedExcalidrawElement> {
  /**
   * Deep-clones an Excalidraw element.
   * Prefers `structuredClone` when available, falling back to
   * JSON round-trip for older runtimes.
   */
  const cloneElement = (
    el: OrderedExcalidrawElement,
  ): OrderedExcalidrawElement => {
    if (typeof globalThis.structuredClone === "function") {
      return globalThis.structuredClone(el) as OrderedExcalidrawElement;
    }
    return JSON.parse(JSON.stringify(el)) as OrderedExcalidrawElement;
  };

  return new Map(elements.map((el) => [el.id, cloneElement(el)]));
}

/**
 * Builds an element map using shallow copies instead of deep clones.
 *
 * This is optimised for the hot path (`handleLocalChange`), where
 * Excalidraw guarantees that mutated elements are new objects with a
 * bumped `version`. Shallow copies are sufficient to snapshot the
 * current state for diffing, and avoid the cost of `structuredClone`
 * on every keystroke/draw.
 *
 * @param elements - The source elements to index.
 * @returns A new `Map<id, element>` with shallow-copied values.
 */
export function buildElementMapShallow(
  elements: readonly OrderedExcalidrawElement[],
): Map<string, OrderedExcalidrawElement> {
  return new Map(
    elements.map((el) => [el.id, { ...el } as OrderedExcalidrawElement]),
  );
}
