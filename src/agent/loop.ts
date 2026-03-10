import { callLLM, getDefaultModel, type ChatMessage, type ToolCall } from "../llm/provider.js";
import { MODELS, type ModelKey } from "../llm/parallel.js";
import { routeMessage } from "./router.js";
import { startTracking, recordStep, stopTracking } from "./progress.js";
import { getTool } from "../tools/registry.js";
import {
  saveConversationMessage,
  getConversationHistory,
} from "../memory/memory.js";

const MAX_ITERATIONS = 30;

// ─── Per-user locks: prevent concurrent loops for the same user ───
const userLocks = new Map<number, Promise<string>>();

// ─── Per-request model context (passed to tools via this map) ─────
// Key: `${userId}` — each active request has its own model
const requestModels = new Map<number, string>();

export function getRequestModel(userId: number): string {
  return requestModels.get(userId) || getDefaultModel();
}

export function setRequestModel(userId: number, model: string): void {
  requestModels.set(userId, model);
  console.log(`[loop] User ${userId} model switched to: ${model}`);
}

export async function runAgentLoop(
  userId: number,
  userMessage: string
): Promise<string> {
  // Wait for any existing loop for this user to finish
  const existingLock = userLocks.get(userId);
  if (existingLock) {
    console.log(`[loop] User ${userId} already has an active loop, waiting...`);
    try { await existingLock; } catch {}
  }

  // Create a new lock for this user
  let resolveLock: (v: string) => void;
  const lockPromise = new Promise<string>((resolve) => { resolveLock = resolve; });
  userLocks.set(userId, lockPromise);

  try {
    const result = await runLoop(userId, userMessage);
    resolveLock!(result);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    resolveLock!(msg);
    throw error;
  } finally {
    // Clean up lock and request model
    if (userLocks.get(userId) === lockPromise) {
      userLocks.delete(userId);
    }
    requestModels.delete(userId);
  }
}

async function runLoop(
  userId: number,
  userMessage: string
): Promise<string> {
  // Smart router: choose the best model based on user message
  const route = routeMessage(userMessage);
  const routedModelId = MODELS[route.primary];
  requestModels.set(userId, routedModelId);
  console.log(`[loop] Router: ${route.reason} (model: ${routedModelId})`);

  // Save the user message
  await saveConversationMessage(userId, "user", userMessage);

  // Load conversation history
  const history = await getConversationHistory(userId);
  const messages: ChatMessage[] = history.map((msg) => ({
    role: msg.role as ChatMessage["role"],
    content: msg.content,
  }));

  // Start progress tracking for this loop
  startTracking(userId, getRequestModel(userId), userMessage);

  console.log(`[loop] Starting for user ${userId} (model: ${getRequestModel(userId)})...`);
  let iterations = 0;

  try {
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const currentModel = getRequestModel(userId);
      console.log(`[loop] Iteration ${iterations} (model: ${currentModel})...`);

      const response = await callLLM(messages, currentModel);

      // If there are tool calls, process them
      if (response.toolCalls.length > 0) {
        // Add assistant message with tool calls
        messages.push({
          role: "assistant",
          content: response.content ?? "",
          tool_calls: response.toolCalls,
        });

        // Execute tool calls in parallel (they are independent)
        // Record each step for progress tracking
        const toolResults = await Promise.all(
          response.toolCalls.map(async (tc) => {
            // Record step BEFORE execution (so user sees what's happening now)
            await recordStep(userId, tc.function.name, iterations);
            return executeToolCall(tc, userId);
          }),
        );
        for (let i = 0; i < response.toolCalls.length; i++) {
          messages.push({
            role: "tool",
            content: toolResults[i],
            tool_call_id: response.toolCalls[i].id,
          });
        }

        // Continue the loop to let the LLM process tool results
        continue;
      }

      console.log(`[loop] Final response received.`);
      let finalContent = response.content ?? "...";

      // Clean up any leaked technical tags
      finalContent = cleanTechnicalTags(finalContent);

      await saveConversationMessage(userId, "assistant", finalContent);
      return finalContent;
    }

    // Hit iteration limit
    const fallback =
      "Desculpe, atingi o limite de iterações ao processar sua mensagem. Tente simplificar a pergunta.";
    await saveConversationMessage(userId, "assistant", fallback);
    return fallback;
  } finally {
    // Always stop tracking when loop ends
    await stopTracking(userId);
  }
}

function cleanTechnicalTags(text: string): string {
  return text
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
    .replace(/<minimax:tool_call>[\s\S]*?<\/minimax:tool_call>/gi, "")
    .replace(/<invoke[\s\S]*?<\/invoke>/gi, "")
    .replace(/<function=[\s\S]*?>/gi, "")
    .replace(/<\/function>/gi, "")
    .replace(/<parameter=[\s\S]*?>[\s\S]*?<\/parameter>/gi, "")
    .replace(/<\/?antml:\w+[^>]*>/gi, "")
    .trim();
}

async function executeToolCall(toolCall: ToolCall, userId: number): Promise<string> {
  const tool = getTool(toolCall.function.name);

  if (!tool) {
    return JSON.stringify({
      error: `Tool not found: ${toolCall.function.name}`,
    });
  }

  try {
    let args: Record<string, unknown> = {};
    if (toolCall.function.arguments) {
      args = JSON.parse(toolCall.function.arguments);
    }

    // Inject userId into args so tools can use per-user context
    args.__userId = userId;

    console.log(`  [tool] ${tool.name}(${JSON.stringify(args)})`);
    const result = await tool.execute(args);
    console.log(`  [tool] result: ${result.substring(0, 200)}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  [tool] error: ${message}`);
    return JSON.stringify({ error: message });
  }
}
