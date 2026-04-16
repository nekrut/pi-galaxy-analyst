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
  executionMode?: "local" | "remote";
  defaultCwd?: string;
}

export function getConfigDir(): string;
export function getConfigPath(): string;
export function loadConfig(): LoomConfig;
export function saveConfig(config: LoomConfig): void;
