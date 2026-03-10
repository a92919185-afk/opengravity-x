// ─── Progress Tracker ────────────────────────────────────────────
// Auto-monitors long-running agent loops and notifies the user
// via Telegram using a DIFFERENT model (non-blocking).

import { callLLM, type ChatMessage } from "../llm/provider.js";
import { MODELS, type ModelKey } from "../llm/parallel.js";

// ─── Types ───────────────────────────────────────────────────────

interface ProgressStep {
  toolName: string;
  iteration: number;
  timestamp: number;
}

export interface ProgressSession {
  userId: number;
  taskDescription: string;
  workingModel: string;
  steps: ProgressStep[];
  startedAt: number;
  notifiedCount: number;
  active: boolean;
}

// Callback to send notification (injected from telegram.ts)
type NotifyFn = (userId: number, message: string) => Promise<void>;

// ─── State ───────────────────────────────────────────────────────

const sessions = new Map<number, ProgressSession>();
let notifyFn: NotifyFn | null = null;

// How many tool calls before we start notifying
const ACTIVATION_THRESHOLD = 2;
// Min seconds between notifications (avoid spam)
const MIN_NOTIFY_INTERVAL_MS = 20_000;

// ─── Setup ───────────────────────────────────────────────────────

export function setProgressNotifyFn(fn: NotifyFn): void {
  notifyFn = fn;
}

// ─── Start tracking a user's loop ────────────────────────────────

export function startTracking(userId: number, workingModel: string, userMessage: string): void {
  sessions.set(userId, {
    userId,
    taskDescription: userMessage.substring(0, 200),
    workingModel,
    steps: [],
    startedAt: Date.now(),
    notifiedCount: 0,
    active: true,
  });
  console.log(`[progress] Started tracking user ${userId}`);
}

// ─── Record a tool execution step ────────────────────────────────

export async function recordStep(
  userId: number,
  toolName: string,
  iteration: number,
): Promise<void> {
  const session = sessions.get(userId);
  if (!session || !session.active) return;

  session.steps.push({
    toolName,
    iteration,
    timestamp: Date.now(),
  });

  // Auto-activate notifications after threshold
  if (session.steps.length === ACTIVATION_THRESHOLD) {
    // First notification: tell user we detected a long task
    await notifyProgress(session, true);
  } else if (session.steps.length > ACTIVATION_THRESHOLD) {
    // Subsequent: notify on each step (with rate limiting)
    const lastNotifyTime = session.steps.length > 1
      ? session.steps[session.steps.length - 2].timestamp
      : session.startedAt;
    const elapsed = Date.now() - lastNotifyTime;

    if (elapsed >= MIN_NOTIFY_INTERVAL_MS || session.notifiedCount === 0) {
      await notifyProgress(session, false);
    }
  }
}

// ─── Stop tracking ───────────────────────────────────────────────

export async function stopTracking(userId: number, finalMessage?: string): Promise<void> {
  const session = sessions.get(userId);
  if (!session || !session.active) return;

  session.active = false;

  // Only send completion notification if we actually sent progress updates
  if (session.notifiedCount > 0 && notifyFn) {
    const totalSec = ((Date.now() - session.startedAt) / 1000).toFixed(0);
    const msg = finalMessage
      ? `✅ **Concluído** em ${totalSec}s (${session.steps.length} etapas)`
      : `✅ **Concluído** em ${totalSec}s (${session.steps.length} etapas)`;
    // Don't send here — the main loop will send the actual response
    console.log(`[progress] User ${userId} completed: ${msg}`);
  }

  sessions.delete(userId);
}

// ─── Generate and send progress notification ─────────────────────
// Uses a DIFFERENT model than the working one to avoid blocking.

async function notifyProgress(session: ProgressSession, isFirst: boolean): Promise<void> {
  if (!notifyFn) return;

  session.notifiedCount++;

  // Pick a reporter model different from the working model
  const reporterModel = pickReporterModel(session.workingModel);

  // Build a concise summary of what's happening
  const totalSteps = session.steps.length;
  const elapsedSec = ((Date.now() - session.startedAt) / 1000).toFixed(0);
  const recentTools = session.steps
    .slice(-3)
    .map((s) => s.toolName)
    .join(" → ");
  const lastTool = session.steps[session.steps.length - 1]?.toolName ?? "?";

  let statusMsg: string;

  if (isFirst) {
    // First notification: lightweight, no LLM call needed
    statusMsg =
      `⏳ **Tarefa em andamento**\n` +
      `Detectei que isso vai levar algumas etapas.\n` +
      `Vou te atualizando conforme avanço.\n\n` +
      `Etapa atual: ${lastTool} (${totalSteps} etapas, ${elapsedSec}s)`;
  } else {
    // Generate a smart status with a different model (fire and forget, don't block)
    try {
      statusMsg = await generateSmartStatus(
        session, reporterModel, totalSteps, elapsedSec, recentTools,
      );
    } catch {
      // Fallback: simple status without LLM
      statusMsg =
        `⏳ **Progresso** | ${totalSteps} etapas | ${elapsedSec}s\n` +
        `Etapa atual: ${lastTool}\n` +
        `Fluxo recente: ${recentTools}`;
    }
  }

  // Send notification (fire and forget to not block the loop)
  notifyFn(session.userId, statusMsg).catch((err) => {
    console.error(`[progress] Failed to notify user ${session.userId}:`, err);
  });
}

// ─── Use a different LLM to generate a human-friendly status ─────

async function generateSmartStatus(
  session: ProgressSession,
  reporterModel: ModelKey,
  totalSteps: number,
  elapsedSec: string,
  recentTools: string,
): Promise<string> {
  const toolHistory = session.steps.map((s) => s.toolName).join(", ");

  const messages: ChatMessage[] = [
    {
      role: "user",
      content:
        `Gere uma mensagem CURTA de progresso (2-3 linhas) para o usuário do Telegram.\n` +
        `Tarefa original: "${session.taskDescription}"\n` +
        `Ferramentas executadas (${totalSteps} etapas, ${elapsedSec}s): ${toolHistory}\n` +
        `Últimas 3: ${recentTools}\n\n` +
        `Formato: comece com ⏳, use **negrito** para destaque, seja conciso e amigável.\n` +
        `Estime o progresso em % baseado nas ferramentas executadas.\n` +
        `NÃO use markdown além de **bold**. Texto puro com emoji.`,
    },
  ];

  const response = await callLLM(messages, MODELS[reporterModel]);
  return response.content ?? `⏳ ${totalSteps} etapas concluídas (${elapsedSec}s)...`;
}

// ─── Pick a model different from the working one ─────────────────

function pickReporterModel(workingModel: string): ModelKey {
  const working = workingModel.toLowerCase();

  // Pick the lightest available model that ISN'T the working one
  if (!working.includes("minimax")) return "minimax";
  if (!working.includes("glm")) return "glm5";
  return "kimi";
}
