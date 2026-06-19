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
  /**
   * The chat scrollport's viewport-relative top/bottom. The chat container is
   * the scroller, so a selection can stay in the DOM but scroll out of view
   * (autoscroll during streaming). When the selection's rect is entirely above
   * or below this band the button is hidden, instead of being stranded at a
   * stale position over the rest of the pane. The left/right edges bound the
   * button horizontally so it can't escape the chat panel into an adjacent
   * pane when the selection overflows past the container.
   */
  container: { top: number; bottom: number; left: number; right: number };
  viewport: { width: number; height: number };
}

export type CopyButtonPlacement = { hidden: true } | { hidden: false; top: number; left: number };

const BUTTON_HEIGHT = 28;
const BUTTON_WIDTH = 80;
const EDGE_PAD = 4;

export function computeCopyButtonPlacement(input: CopyButtonInput): CopyButtonPlacement {
  const { isCollapsed, rangeCount, inContainer, rect, container, viewport } = input;

  if (isCollapsed || rangeCount === 0) return { hidden: true };
  if (!inContainer) return { hidden: true };
  // A detached/empty selection (e.g. its nodes were re-rendered out from under
  // it during streaming) collapses to a zero-area rect -- treat it as gone.
  if (!rect.width && !rect.height) return { hidden: true };
  // The selection has scrolled entirely out of the chat scrollport (above or
  // below it). The fixed button would otherwise sit at a stale position over
  // the rest of the pane -- the #299 "stranded in the middle" symptom -- so
  // hide it. A partially-visible selection straddling an edge stays shown.
  if (rect.bottom < container.top || rect.top > container.bottom) return { hidden: true };

  const top =
    rect.bottom + 6 + BUTTON_HEIGHT > viewport.height
      ? rect.top - BUTTON_HEIGHT - 4
      : rect.bottom + 4;

  // Anchor the button's right edge to the selection, but never past the chat
  // container's right edge: a horizontally-scrollable block (e.g. a long line
  // in a code block) lays its text out far beyond the visible panel, and the
  // Range rect isn't clipped by that overflow. Clamping to the viewport alone
  // would fling the button into an adjacent pane (#339), so bound left to the
  // container's edges -- still kept on-screen by the viewport as a backstop.
  const desiredLeft = Math.min(rect.right, container.right) - BUTTON_WIDTH;
  const minLeft = Math.max(EDGE_PAD, container.left + EDGE_PAD);
  const maxLeft = Math.min(
    viewport.width - BUTTON_WIDTH - EDGE_PAD,
    container.right - BUTTON_WIDTH - EDGE_PAD,
  );
  const left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));

  return { hidden: false, top, left };
}
