/**
 * Public types for the team_dispatch feature.
 * See docs/superpowers/specs/2026-04-17-multi-agent-dispatch-design.md.
 */

export interface TeamSpec {
  description: string;
  roles: RoleSpec[];
  max_rounds?: number;
  model?: string;
}

export interface RoleSpec {
  name: string;
  system_prompt: string;
  tools_read: string[];
  tools_write?: string[];
  model?: string;
}

export interface TeamResult {
  converged: boolean;
  rounds: number;
  final_output: string;
  transcript: TeamTurn[];
  usage: { input_tokens: number; output_tokens: number };
  aborted?: boolean;
  budget_exhausted?: boolean;
  error?: string;
}

export interface TeamTurn {
  round: number;
  role: string;
  content: string;
  tool_calls?: { name: string; args: unknown; result: unknown }[];
  approved?: boolean;
}

/**
 * Side-effect surface the dispatcher needs.
 * Injected so the dispatcher is testable without a real Pi runtime.
 */
export interface DispatchDeps {
  runRoleTurn: (
    role: RoleSpec,
    systemPreamble: string,
    userMessage: string,
    tools: unknown[],
    signal: AbortSignal,
  ) => Promise<RoleTurnResult>;
}

export interface RoleTurnResult {
  content: string;
  tool_calls?: { name: string; args: unknown; result: unknown }[];
  usage: { input_tokens: number; output_tokens: number };
}
