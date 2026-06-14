// Pure placement logic for the floating text-selection "Copy" button.
// Kept DOM-free so the visibility/position decision is unit-testable; the
// chat panel feeds it live selection geometry and applies the result.

export interface CopyButtonRect {
  top: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface CopyButtonInput {
  isCollapsed: boolean;
  rangeCount: number;
  /** Whether the selection range lives inside the chat container. */
  inContainer: boolean;
  /** The selection's viewport-relative bounding rect. */
  rect: CopyButtonRect;
  viewport: { width: number; height: number };
}

export type CopyButtonPlacement = { hidden: true } | { hidden: false; top: number; left: number };

const BUTTON_HEIGHT = 28;
const BUTTON_WIDTH = 80;

export function computeCopyButtonPlacement(input: CopyButtonInput): CopyButtonPlacement {
  const { isCollapsed, rangeCount, inContainer, rect, viewport } = input;

  if (isCollapsed || rangeCount === 0) return { hidden: true };
  if (!inContainer) return { hidden: true };
  // A detached/empty selection (e.g. its nodes were re-rendered out from under
  // it during streaming) collapses to a zero-area rect -- treat it as gone.
  if (!rect.width && !rect.height) return { hidden: true };

  const top =
    rect.bottom + 6 + BUTTON_HEIGHT > viewport.height
      ? rect.top - BUTTON_HEIGHT - 4
      : rect.bottom + 4;
  const left = Math.max(4, Math.min(rect.right - BUTTON_WIDTH, viewport.width - BUTTON_WIDTH - 4));

  return { hidden: false, top, left };
}
