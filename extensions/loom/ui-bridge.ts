/**
 * UI bridge — translates state and notebook changes into shell widgets.
 *
 * Notebook tab is fed by notebook.md file changes. Activity tab is fed by
 * activity.jsonl events. No plan widgets — plans live as markdown sections
 * inside the notebook itself.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { onNotebookChange, getNotebookPath } from "./state.js";
import { onActivityChange, getActivityEvents } from "./activity.js";
import {
  LoomWidgetKey,
  encodeJsonWidget,
  encodeMarkdownWidget,
} from "../../shared/loom-shell-contract.js";

export function setupUIBridge(pi: ExtensionAPI): void {
  let latestCtx: ExtensionContext | null = null;
  const last = { notebookMd: "", activityJson: "" };

  pi.on("before_agent_start", async (_event, ctx) => {
    latestCtx = ctx;
    const events = getActivityEvents();
    if (events.length > 0) {
      const json = JSON.stringify(events);
      if (json !== last.activityJson) {
        last.activityJson = json;
        ctx.ui.setWidget(LoomWidgetKey.Activity, encodeJsonWidget(events));
      }
    }
  });

  onNotebookChange((content) => {
    if (!latestCtx) return;
    if (content === last.notebookMd) return;
    last.notebookMd = content;
    const nbPath = getNotebookPath();
    const header = nbPath ? `> \`${nbPath}\`\n\n` : "";
    latestCtx.ui.setWidget(LoomWidgetKey.Notebook, encodeMarkdownWidget(header + content));
  });

  onActivityChange((events) => {
    if (!latestCtx) return;
    const json = JSON.stringify(events);
    if (json === last.activityJson) return;
    last.activityJson = json;
    latestCtx.ui.setWidget(LoomWidgetKey.Activity, encodeJsonWidget(events));
  });
}
