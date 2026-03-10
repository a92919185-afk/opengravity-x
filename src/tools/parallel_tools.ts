import { registerTool } from "./registry.js";
import {
  callModelsInParallel,
  successOnly,
  raceModels,
  MODELS,
  type ModelKey,
} from "../llm/parallel.js";
import type { ChatMessage } from "../llm/provider.js";

// ─── parallel_research ───────────────────────────────────────────
// Ask multiple models the same question in parallel and combine results.

registerTool({
  name: "parallel_research",
  description:
    "Send the same question to multiple AI models in parallel and get combined perspectives. " +
    "Use this for research, comparisons, complex analysis, or when you want diverse viewpoints. " +
    "Models: 'minimax' (fast, general), 'glm5' (deep reasoning), 'kimi' (vision). " +
    "Returns each model's response side by side.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question or task to send to all models.",
      },
      models: {
        type: "string",
        description:
          "Comma-separated model keys to query. Default: 'minimax,glm5'. Options: minimax, glm5, kimi.",
      },
    },
    required: ["question"],
  },
  execute: async (args) => {
    const question = args.question as string;
    const modelStr = (args.models as string) || "minimax,glm5";
    const modelKeys = modelStr
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((k) => k in MODELS) as ModelKey[];

    if (modelKeys.length === 0) {
      return JSON.stringify({ error: "Nenhum modelo válido especificado." });
    }

    const messages: ChatMessage[] = [
      { role: "user", content: question },
    ];

    console.log(`[parallel_research] Querying ${modelKeys.join(", ")}...`);
    const results = await callModelsInParallel(modelKeys, messages);
    const successful = successOnly(results);

    const output = results.map((r) => ({
      model: r.model,
      modelId: r.modelId,
      durationMs: r.durationMs,
      success: r.response !== null,
      response: r.response?.content ?? null,
      error: r.error,
    }));

    return JSON.stringify({
      query: question,
      modelsQueried: modelKeys,
      successCount: successful.length,
      totalCount: results.length,
      results: output,
    });
  },
});

// ─── fast_answer ─────────────────────────────────────────────────
// Race models and return the fastest response.

registerTool({
  name: "fast_answer",
  description:
    "Race multiple AI models and return the fastest response. " +
    "Use this when speed matters more than thoroughness. " +
    "All models get the same question; first to respond wins.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask.",
      },
      models: {
        type: "string",
        description:
          "Comma-separated model keys. Default: 'minimax,glm5'. Options: minimax, glm5, kimi.",
      },
    },
    required: ["question"],
  },
  execute: async (args) => {
    const question = args.question as string;
    const modelStr = (args.models as string) || "minimax,glm5";
    const modelKeys = modelStr
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((k) => k in MODELS) as ModelKey[];

    if (modelKeys.length === 0) {
      return JSON.stringify({ error: "Nenhum modelo válido especificado." });
    }

    const messages: ChatMessage[] = [
      { role: "user", content: question },
    ];

    console.log(`[fast_answer] Racing ${modelKeys.join(", ")}...`);
    try {
      const winner = await raceModels(modelKeys, messages);
      return JSON.stringify({
        query: question,
        winner: winner.model,
        modelId: winner.modelId,
        durationMs: winner.durationMs,
        response: winner.response?.content ?? null,
      });
    } catch {
      return JSON.stringify({ error: "Todos os modelos falharam na corrida." });
    }
  },
});
