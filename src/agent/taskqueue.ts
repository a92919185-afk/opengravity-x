// ─── Background Task Queue ───────────────────────────────────────
// Runs long tasks in background and notifies the user via Telegram when done.

import { callLLM, type ChatMessage } from "../llm/provider.js";
import { MODELS, type ModelKey } from "../llm/parallel.js";

// ─── Types ───────────────────────────────────────────────────────

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export interface BackgroundTask {
  id: string;
  userId: number;
  description: string;
  model: ModelKey;
  status: TaskStatus;
  result: string | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

// Callback to send a message back to the user (injected by telegram.ts)
type NotifyFn = (userId: number, message: string) => Promise<void>;

// ─── State ───────────────────────────────────────────────────────

const tasks = new Map<string, BackgroundTask>();
let notifyUser: NotifyFn | null = null;
let taskCounter = 0;

// ─── Setup ───────────────────────────────────────────────────────

export function setNotifyFn(fn: NotifyFn): void {
  notifyUser = fn;
}

// ─── Create & run a background task ──────────────────────────────

export function enqueueTask(
  userId: number,
  description: string,
  prompt: string,
  model: ModelKey = "minimax",
): string {
  const id = `task-${++taskCounter}-${Date.now()}`;
  const task: BackgroundTask = {
    id,
    userId,
    description,
    model,
    status: "queued",
    result: null,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
  };

  tasks.set(id, task);
  console.log(`[taskqueue] Enqueued ${id}: "${description}" (model: ${model})`);

  // Run in background (fire and forget)
  runTask(task, prompt).catch((err) => {
    console.error(`[taskqueue] Unexpected error in task ${id}:`, err);
  });

  return id;
}

async function runTask(task: BackgroundTask, prompt: string): Promise<void> {
  task.status = "running";
  console.log(`[taskqueue] Running ${task.id}...`);

  try {
    const messages: ChatMessage[] = [
      { role: "user", content: prompt },
    ];

    const response = await callLLM(messages, MODELS[task.model]);
    task.result = response.content ?? "(sem resposta)";
    task.status = "completed";
    task.completedAt = Date.now();

    const durationSec = ((task.completedAt - task.createdAt) / 1000).toFixed(1);
    console.log(`[taskqueue] ${task.id} completed in ${durationSec}s`);

    // Notify user
    if (notifyUser) {
      const msg =
        `Tarefa concluida: ${task.description}\n` +
        `Modelo: ${task.model} | Tempo: ${durationSec}s\n\n` +
        task.result;
      await notifyUser(task.userId, msg);
    }
  } catch (err) {
    task.error = err instanceof Error ? err.message : String(err);
    task.status = "failed";
    task.completedAt = Date.now();
    console.error(`[taskqueue] ${task.id} failed: ${task.error}`);

    if (notifyUser) {
      await notifyUser(
        task.userId,
        `Tarefa falhou: ${task.description}\nErro: ${task.error}`,
      );
    }
  }
}

// ─── Query tasks ─────────────────────────────────────────────────

export function getTask(id: string): BackgroundTask | undefined {
  return tasks.get(id);
}

export function getUserTasks(userId: number): BackgroundTask[] {
  return [...tasks.values()]
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getPendingTasks(userId: number): BackgroundTask[] {
  return getUserTasks(userId).filter(
    (t) => t.status === "queued" || t.status === "running",
  );
}

export function cleanOldTasks(maxAgeMs: number = 3600_000): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, task] of tasks) {
    if (task.completedAt && now - task.completedAt > maxAgeMs) {
      tasks.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}
