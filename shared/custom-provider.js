import fs from "node:fs";
import path from "node:path";

/**
 * A provider entry is "custom" (an OpenAI-compatible endpoint) when it carries
 * a non-empty baseUrl. That single field is the discriminator everywhere.
 */
export function isCustomProvider(entry) {
  return Boolean(entry && entry.baseUrl);
}

/**
 * Build a permissive openai-completions model def from just a model id. Cost is
 * zeroed (custom endpoints are typically free/self-hosted) and the context
 * window mirrors the defaults used for the existing local litellm setup. The
 * model is registered for selection; the key is supplied separately at runtime.
 */
export function synthesizeModelDef(entry) {
  if (!entry.model) {
    throw new Error("custom provider entry requires a model id to synthesize a model def");
  }
  return {
    id: entry.model,
    name: entry.model,
    reasoning: false,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

/**
 * Return a NEW models.json config with the custom provider upserted. Other
 * providers are preserved untouched. The provider entry deliberately omits
 * apiKey -- the key is injected at runtime via pi's --api-key flag so it never
 * lands on disk in plaintext.
 */
export function mergeCustomProviderIntoModelsConfig(modelsConfig, providerName, entry) {
  const providers = { ...((modelsConfig && modelsConfig.providers) || {}) };
  providers[providerName] = {
    name: providerName,
    baseUrl: entry.baseUrl,
    api: "openai-completions",
    models: [synthesizeModelDef(entry)],
  };
  return { ...modelsConfig, providers };
}

/**
 * Read models.json (if present), upsert the custom provider, write it back with
 * mode 0600. Best-effort: a malformed existing file is treated as empty rather
 * than throwing, matching how bin/loom.js already tolerates models.json.
 */
export function syncCustomProviderModelsFile(modelsJsonPath, providerName, entry) {
  let current = {};
  try {
    if (fs.existsSync(modelsJsonPath)) {
      current = JSON.parse(fs.readFileSync(modelsJsonPath, "utf-8")) || {};
    }
  } catch {
    current = {};
  }
  const merged = mergeCustomProviderIntoModelsConfig(current, providerName, entry);
  fs.mkdirSync(path.dirname(modelsJsonPath), { recursive: true });
  // Plain write + chmod (not tmp+rename) mirrors how bin/loom.js writes
  // mcp.json: this file is regenerated on every launch, so a torn write is
  // self-healing. chmod runs after the write because writeFileSync's mode
  // option only applies when the file is first created.
  fs.writeFileSync(modelsJsonPath, JSON.stringify(merged, null, 2), { mode: 0o600 });
  try {
    fs.chmodSync(modelsJsonPath, 0o600);
  } catch {
    /* best-effort */
  }
  return merged;
}

/**
 * Resolve the API key for a custom provider at runtime. Orbit injects the
 * decrypted key via LOOM_ACTIVE_LLM_API_KEY; the standalone CLI uses the
 * plaintext apiKey on the entry. Returns undefined when neither is present.
 */
export function resolveActiveLlmApiKey(entry, env) {
  return (env && env.LOOM_ACTIVE_LLM_API_KEY) || (entry && entry.apiKey);
}
