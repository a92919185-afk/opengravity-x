import { callLLM, type ChatMessage, type ToolCall } from "../llm/provider.js";
import { getTool } from "../tools/registry.js";
import {
  saveConversationMessage,
  getConversationHistory,
} from "../memory/memory.js";

const MAX_ITERATIONS = 30;

export async function runAgentLoop(
  userId: number,
  userMessage: string
): Promise<string> {
  // Save the user message
  await saveConversationMessage(userId, "user", userMessage);

  // Load conversation history
  const history = await getConversationHistory(userId);
  const messages: ChatMessage[] = history.map((msg) => ({
    role: msg.role as ChatMessage["role"],
    content: msg.content,
  }));

  console.log(`[loop] Starting for user ${userId}...`);
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`[loop] Iteration ${iterations}...`);

    const response = await callLLM(messages);

    // If there are tool calls, process them
    if (response.toolCalls.length > 0) {
      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: response.content ?? "",
        tool_calls: response.toolCalls,
      });

      // Execute each tool call
      for (const toolCall of response.toolCalls) {
        const result = await executeToolCall(toolCall);
        messages.push({
          role: "tool",
          content: result,
          tool_call_id: toolCall.id,
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

async function executeToolCall(toolCall: ToolCall): Promise<string> {
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
