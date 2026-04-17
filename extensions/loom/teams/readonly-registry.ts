/**
 * Curated set of tool names that are "read-only" for team_dispatch purposes:
 * they do not mutate Loom analysis state (plan / notebook / findings /
 * checkpoints / decisions).
 *
 * When a new Loom tool is added, consider whether it belongs here. The
 * team-readonly-registry.test.ts suite enforces that every name here exists
 * in the live tool registry — preventing stale entries.
 */

export const READONLY_LOOM_TOOLS: ReadonlySet<string> = new Set([
  // Plan reads
  "analysis_plan_summary",
  "analysis_plan_decisions",
  // Interpretation reads
  "interpretation_list_findings",
  // Workflow reads
  "workflow_invocation_check",
  // BRC reads
  "brc_context_view",
  // Notebook reads (if present; keep conservative)
  "analysis_notebook_open",
]);

/**
 * Pi.dev built-in tools classified as read-only.
 * Conservative: bash, edit_file, write_file are NOT read-only.
 */
export const READONLY_PI_BUILTINS: ReadonlySet<string> = new Set([
  "read_file",
  "grep",
  "list_files",
  "glob",
]);

export function isReadOnly(toolName: string): boolean {
  return READONLY_LOOM_TOOLS.has(toolName) || READONLY_PI_BUILTINS.has(toolName);
}
