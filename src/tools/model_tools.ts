import { registerTool } from "./registry.js";
import { getActiveModel, setActiveModel } from "../llm/provider.js";

const AVAILABLE_MODELS: Record<string, { id: string; description: string }> = {
  minimax: {
    id: "minimax-m2.5",
    description: "Fast general-purpose model. Best for coding, conversations, and document tasks.",
  },
  glm5: {
    id: "glm-5",
    description: "Deep reasoning model. Best for complex logic, debugging, and intricate problem-solving.",
  },
  kimi: {
    id: "kimi-k2.5",
    description: "Vision-capable model. Best for image/video analysis and multi-agent orchestration.",
  },
};

registerTool({
  name: "switch_model",
  description:
    "Switch the active LLM model for subsequent responses. Use 'minimax' for general tasks and coding, 'glm5' for deep reasoning and complex debugging, 'kimi' for vision tasks (images/videos). The switch takes effect on the NEXT LLM call.",
  parameters: {
    type: "object",
    properties: {
      model: {
        type: "string",
        description: "Model to switch to: 'minimax', 'glm5', or 'kimi'.",
        enum: ["minimax", "glm5", "kimi"],
      },
      reason: {
        type: "string",
        description: "Brief reason for switching (helps with transparency).",
      },
    },
    required: ["model"],
  },
  execute: async (args) => {
    const modelKey = (args.model as string).toLowerCase();
    const entry = AVAILABLE_MODELS[modelKey];

    if (!entry) {
      return JSON.stringify({
        error: `Modelo desconhecido: ${args.model}. Disponíveis: minimax, glm5, kimi.`,
      });
    }

    const previous = getActiveModel();
    setActiveModel(entry.id);

    return JSON.stringify({
      switched: true,
      from: previous,
      to: entry.id,
      description: entry.description,
      reason: args.reason || "not specified",
    });
  },
});

registerTool({
  name: "get_current_model",
  description:
    "Returns which LLM model is currently active. Use this to check before deciding if you need to switch.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const current = getActiveModel();
    const modelInfo = Object.entries(AVAILABLE_MODELS).find(([_, v]) => v.id === current);
    return JSON.stringify({
      active_model: current,
      alias: modelInfo?.[0] ?? "unknown",
      description: modelInfo?.[1]?.description ?? "Unknown model",
      available_models: Object.entries(AVAILABLE_MODELS).map(([key, val]) => ({
        alias: key,
        id: val.id,
        description: val.description,
      })),
    });
  },
});
