export interface LoomConfig {
  llm?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  };
  galaxy?: {
    active: string | null;
    profiles: Record<string, { url: string; apiKey: string }>;
  };
  defaultCwd?: string;
  /**
   * Opt-in flags for experimental subsystems. Off by default; set the
   * matching env var (e.g. LOOM_TEAM_DISPATCH=1) to override per-session.
   */
  experiments?: {
    /** Register the experimental team_dispatch tool and its prompt guidance. */
    teamDispatch?: boolean;
  };
}

export function getConfigDir(): string;
export function getConfigPath(): string;
export function loadConfig(): LoomConfig;
export function saveConfig(config: LoomConfig): void;
