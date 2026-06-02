import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { submitFeedback, buildBrainSysinfo, summarizeActivityTail } from "./feedback.js";
import { getRecentActivityEvents } from "./activity.js";
import { SCHEMA_VERSION } from "../../shared/feedback-contract.js";
import type { FeedbackPayload } from "../../shared/feedback-contract.js";

/**
 * /feedback -- gather feedback inline via ctx.ui and POST it to the capture
 * worker. Cross-shell: ctx.ui renders in Orbit and the Loom CLI alike. The
 * brain cannot open Orbit's HTML modal (no plumbing), so this is the brain's
 * own capture path. Guards on ctx.hasUI so it never POSTs an empty payload in
 * non-interactive/RPC mode.
 */
export function registerFeedbackCommand(pi: ExtensionAPI): void {
  pi.registerCommand("feedback", {
    description: "Send feedback about Loom to the team (captures optional diagnostics).",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      if (!ctx.hasUI) {
        ctx.ui.notify(
          "/feedback needs interactive mode. Re-run it in Orbit or an interactive CLI session.",
          "warning",
        );
        return;
      }

      const title =
        (args && args.trim()) || (await ctx.ui.input("Feedback -- short title", "Summarize it"));
      if (!title || !title.trim()) return;

      const body = (await ctx.ui.editor("What's the feedback?", "")) ?? "";

      const includeDiagnostics = await ctx.ui.confirm(
        "Include diagnostics?",
        "Attach system info + a summarized recent-activity log to help us debug. No API keys or credentials are sent.",
      );

      const payload: FeedbackPayload = {
        schemaVersion: SCHEMA_VERSION,
        source: "loom-cli",
        title: title.trim(),
        body: body.trim(),
        clientTs: new Date().toISOString(),
        ...(includeDiagnostics
          ? {
              sysinfo: buildBrainSysinfo(),
              activityTail: summarizeActivityTail(getRecentActivityEvents(15)),
            }
          : {}),
      };

      const res = await submitFeedback(payload);
      if (res.ok) {
        ctx.ui.notify("Thanks -- your feedback was sent.", "info");
      } else {
        ctx.ui.notify(
          `Couldn't reach the feedback service (${res.error ?? "unknown error"}). Try again later or use Report in Orbit.`,
          "error",
        );
      }
    },
  });
}
