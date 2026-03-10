import { registerTool } from "./registry.js";
import {
  enqueueTask,
  getTask,
  getUserTasks,
  getPendingTasks,
  type BackgroundTask,
} from "../agent/taskqueue.js";
import { MODELS, type ModelKey } from "../llm/parallel.js";

// ─── background_task ─────────────────────────────────────────────

registerTool({
  name: "background_task",
  description:
    "Start a long-running task in the background. The user will be notified via Telegram when it completes. " +
    "Use this for tasks that take time: deep research, long analysis, code generation. " +
    "Returns immediately with a task ID. The user can check status with task_status.",
  parameters: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "Short description of what the task does (shown to user in notification).",
      },
      prompt: {
        type: "string",
        description: "The full prompt/question to send to the model for this task.",
      },
      model: {
        type: "string",
        description: "Model to use: 'minimax' (fast), 'glm5' (reasoning), 'kimi' (vision). Default: minimax.",
        enum: ["minimax", "glm5", "kimi"],
      },
    },
    required: ["description", "prompt"],
  },
  execute: async (args) => {
    const userId = args.__userId as number | undefined;
    if (!userId) {
      return JSON.stringify({ error: "userId required for background tasks." });
    }

    const description = args.description as string;
    const prompt = args.prompt as string;
    const modelKey = ((args.model as string) || "minimax").toLowerCase();

    if (!(modelKey in MODELS)) {
      return JSON.stringify({ error: `Modelo inválido: ${modelKey}. Use: minimax, glm5, kimi.` });
    }

    const taskId = enqueueTask(userId, description, prompt, modelKey as ModelKey);

    return JSON.stringify({
      taskId,
      status: "queued",
      description,
      model: modelKey,
      message: `Tarefa "${description}" foi colocada na fila. Você será notificado quando terminar.`,
    });
  },
});

// ─── task_status ─────────────────────────────────────────────────

registerTool({
  name: "task_status",
  description:
    "Check the status of a specific background task by ID, or list all recent tasks for the user.",
  parameters: {
    type: "object",
    properties: {
      task_id: {
        type: "string",
        description: "The task ID to check. If omitted, lists all recent tasks.",
      },
    },
  },
  execute: async (args) => {
    const userId = args.__userId as number | undefined;
    const taskId = args.task_id as string | undefined;

    if (taskId) {
      const task = getTask(taskId);
      if (!task) {
        return JSON.stringify({ error: `Tarefa não encontrada: ${taskId}` });
      }
      return JSON.stringify(formatTask(task));
    }

    if (!userId) {
      return JSON.stringify({ error: "userId required." });
    }

    const userTasks = getUserTasks(userId).slice(0, 10);
    if (userTasks.length === 0) {
      return JSON.stringify({ message: "Nenhuma tarefa em background encontrada." });
    }

    return JSON.stringify({
      totalTasks: userTasks.length,
      pending: getPendingTasks(userId).length,
      tasks: userTasks.map(formatTask),
    });
  },
});

function formatTask(task: BackgroundTask) {
  const durationMs = task.completedAt
    ? task.completedAt - task.createdAt
    : Date.now() - task.createdAt;

  return {
    id: task.id,
    description: task.description,
    model: task.model,
    status: task.status,
    durationSec: (durationMs / 1000).toFixed(1),
    result: task.status === "completed" ? task.result?.substring(0, 500) : null,
    error: task.error,
  };
}
