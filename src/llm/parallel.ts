import { callLLM, type ChatMessage, type LLMResponse } from "./provider.js";

// ─── Model catalog ───────────────────────────────────────────────
export const MODELS = {
  minimax: "minimax-m2.5",
  glm5: "glm-5",
  kimi: "kimi-k2.5",
} as const;

export type ModelKey = keyof typeof MODELS;

// ─── Call a specific model by key ────────────────────────────────
export async function callModel(
  modelKey: ModelKey,
  messages: ChatMessage[],
): Promise<LLMResponse> {
  return callLLM(messages, MODELS[modelKey]);
}

// ─── Parallel result ─────────────────────────────────────────────
export interface ParallelResult {
  model: ModelKey;
  modelId: string;
  response: LLMResponse | null;
  error: string | null;
  durationMs: number;
}

// ─── Call multiple models in parallel ────────────────────────────
// Returns results for all models (including failures).
// Use `successOnly()` helper to filter.
export async function callModelsInParallel(
  modelKeys: ModelKey[],
  messages: ChatMessage[],
): Promise<ParallelResult[]> {
  const start = Date.now();

  const promises = modelKeys.map(async (key): Promise<ParallelResult> => {
    const t0 = Date.now();
    try {
      const response = await callLLM(messages, MODELS[key]);
      return {
        model: key,
        modelId: MODELS[key],
        response,
        error: null,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      return {
        model: key,
        modelId: MODELS[key],
        response: null,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - t0,
      };
    }
  });

  const results = await Promise.all(promises);
  const totalMs = Date.now() - start;
  console.log(
    `[parallel] ${modelKeys.join(", ")} completed in ${totalMs}ms ` +
    `(${results.filter(r => r.response).length}/${results.length} succeeded)`,
  );
  return results;
}

// ─── Helper: filter successful results ───────────────────────────
export function successOnly(results: ParallelResult[]): ParallelResult[] {
  return results.filter((r) => r.response !== null);
}

// ─── Race: return the first model that responds ──────────────────
export async function raceModels(
  modelKeys: ModelKey[],
  messages: ChatMessage[],
): Promise<ParallelResult> {
  const results = await Promise.any(
    modelKeys.map(async (key): Promise<ParallelResult> => {
      const t0 = Date.now();
      const response = await callLLM(messages, MODELS[key]);
      return {
        model: key,
        modelId: MODELS[key],
        response,
        error: null,
        durationMs: Date.now() - t0,
      };
    }),
  );
  return results;
}
