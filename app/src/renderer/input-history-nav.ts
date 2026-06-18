// Helpers for shell-like prompt-history recall in the chat input.
//
// ↑/↓ should first move the caret within a multi-line message and only recall
// prompt history once the caret is on the first line (↑) or last line (↓).
// The tricky part is that the chat input soft-wraps: a long single-logical-line
// message spans several *visual* rows with no "\n", so a newline scan alone
// can't tell which visual row the caret sits on (issue #314). We measure the
// caret's visual row with a hidden mirror element and fall back to the
// newline-based check when measurement isn't available.

export interface LineFlags {
  /** caret is on the first (visual) line of the input */
  onFirstLine: boolean;
  /** caret is on the last (visual) line of the input */
  onLastLine: boolean;
}

/** Geometry-free first/last-line check based on explicit newlines. Correct for
 *  hard line breaks; blind to soft-wrapped rows (callers prefer
 *  {@link caretVisualLineFlags}, which falls back to this). */
export function logicalLineFlags(value: string, caretPos: number): LineFlags {
  const pos = Math.max(0, Math.min(caretPos, value.length));
  return {
    onFirstLine: value.lastIndexOf("\n", pos - 1) === -1,
    onLastLine: value.indexOf("\n", pos) === -1,
  };
}

/** Pure decision: should ↑/↓ recall prompt history instead of moving the caret?
 *  Yes only at the first line going up, or the last line going down. */
export function shouldRecallOnArrow(direction: "up" | "down", lines: LineFlags): boolean {
  return direction === "up" ? lines.onFirstLine : lines.onLastLine;
}

const MIRROR_STYLE_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontVariant",
  "letterSpacing",
  "textTransform",
  "lineHeight",
  "textIndent",
  "wordSpacing",
  "tabSize",
  "wordBreak",
  "overflowWrap",
  "whiteSpace",
] as const;

/** First/last *visual* line flags for the caret in a (possibly soft-wrapped)
 *  textarea. Renders the text into a hidden mirror sized to the textarea's
 *  content width so wrapping matches what the user sees, then reads the caret
 *  row from a marker's offset. Falls back to {@link logicalLineFlags} when the
 *  measurement can't run (e.g. no layout engine in tests). */
export function caretVisualLineFlags(ta: HTMLTextAreaElement): LineFlags {
  const value = ta.value;
  const caretPos = ta.selectionStart ?? 0;
  if (value === "") return { onFirstLine: true, onLastLine: true };
  return measureCaretLines(ta, value, caretPos) ?? logicalLineFlags(value, caretPos);
}

function measureCaretLines(
  ta: HTMLTextAreaElement,
  value: string,
  caretPos: number,
): LineFlags | null {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
    return null;
  }
  const cs = getComputedStyle(ta);
  const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
  // Content width excludes padding (and any scrollbar), so wrapping in the
  // mirror matches the textarea regardless of its box-sizing.
  const contentWidth =
    ta.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
  if (!(lineHeight > 0) || !(contentWidth > 0)) return null;

  const mirror = document.createElement("div");
  for (const prop of MIRROR_STYLE_PROPS) {
    mirror.style[prop] = cs[prop];
  }
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = cs.overflowWrap || "break-word";
  mirror.style.boxSizing = "content-box";
  mirror.style.width = `${contentWidth}px`;
  mirror.style.padding = "0";
  mirror.style.border = "0";
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.left = "-9999px";
  mirror.style.top = "0";
  mirror.style.height = "auto";
  mirror.style.maxHeight = "none";
  mirror.style.overflow = "hidden";

  mirror.appendChild(document.createTextNode(value.slice(0, caretPos)));
  const marker = document.createElement("span");
  // Non-empty so the marker lays out on the caret's line; the remaining text
  // also gives the mirror its full height for the last-line check.
  marker.textContent = value.slice(caretPos) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const markerTop = marker.offsetTop;
  const contentHeight = mirror.scrollHeight;
  document.body.removeChild(mirror);

  if (!Number.isFinite(markerTop) || !Number.isFinite(contentHeight)) return null;
  return {
    onFirstLine: markerTop < lineHeight,
    onLastLine: markerTop + lineHeight > contentHeight - 0.5,
  };
}
