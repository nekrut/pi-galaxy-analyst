/**
 * UI Bridge -- translates Loom state changes into shell widgets.
 * Single emission path: state mutation -> onPlanChange -> setWidget.
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AnalysisPlan, AnalysisStep } from "./types.js";
import {
  onPlanChange,
  onNotebookChange,
  formatPlanSummary,
  getCurrentPlan,
  getNotebookPath,
} from "./state.js";
import { onActivityChange, getActivityEvents } from "./activity.js";
import {
  LoomWidgetKey,
  encodeJsonWidget,
  encodeMarkdownWidget,
  type ShellStep,
} from "../../shared/loom-shell-contract.js";

function toShellStep(step: AnalysisStep): ShellStep {
  return {
    id: step.id,
    name: step.name,
    description: step.description,
    status: step.status,
    dependsOn: step.dependsOn,
    result: step.result?.summary,
    command: step.execution.toolId || step.execution.workflowId,
  };
}

/** Convert all steps in a plan. Exported for testing. */
export function toShellSteps(plan: AnalysisPlan): ShellStep[] {
  return plan.steps.map(toShellStep);
}

function emitPlanWidgets(
  ctx: ExtensionContext,
  plan: AnalysisPlan,
  last: { planMd: string; stepsJson: string }
): void {
  const md = formatPlanSummary(plan);
  const stepsJson = JSON.stringify(toShellSteps(plan));

  if (md !== last.planMd) {
    last.planMd = md;
    ctx.ui.setWidget(LoomWidgetKey.Plan, encodeMarkdownWidget(md));
  }

  if (stepsJson !== last.stepsJson) {
    last.stepsJson = stepsJson;
    ctx.ui.setWidget(LoomWidgetKey.Steps, encodeJsonWidget(toShellSteps(plan)));
  }
}

/**
 * Wire up the bridge. Captures the latest ExtensionContext from
 * before_agent_start so plan-change listeners can emit widgets.
 * Dirty-checks to avoid redundant IPC emissions.
 */
export function setupUIBridge(pi: ExtensionAPI): void {
  let latestCtx: ExtensionContext | null = null;
  const last = { planMd: "", stepsJson: "", notebookMd: "", activityJson: "" };

  pi.on("before_agent_start", async (_event, ctx) => {
    latestCtx = ctx;
    const plan = getCurrentPlan();
    if (plan) {
      emitPlanWidgets(ctx, plan, last);
    }
    // Seed the Activity pane with whatever has already been loaded for this
    // session -- either hydrated from disk or accumulated in the same process.
    const events = getActivityEvents();
    if (events.length > 0) {
      const json = JSON.stringify(events);
      if (json !== last.activityJson) {
        last.activityJson = json;
        ctx.ui.setWidget(LoomWidgetKey.Activity, encodeJsonWidget(events));
      }
    }
  });

  onPlanChange((plan) => {
    if (!plan || !latestCtx) return;
    emitPlanWidgets(latestCtx, plan, last);
  });

  // Refresh the notebook pane whenever syncToNotebook writes a new revision.
  onNotebookChange((content) => {
    if (!latestCtx) return;
    if (content === last.notebookMd) return;
    last.notebookMd = content;
    const path = getNotebookPath();
    const header = path ? `> \`${path}\`\n\n` : "";
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
