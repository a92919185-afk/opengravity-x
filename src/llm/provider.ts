import Groq from "groq-sdk";
import { config } from "../config.js";
import { getToolSchemas } from "../tools/registry.js";
import fs from "fs";
import axios from "axios";

// Client initialization with optional keys
const groqClient = config.GROQ_API_KEY ? new Groq({ apiKey: config.GROQ_API_KEY }) : null;
// OpenCode client will be handled via axios to support different endpoints (/messages vs /chat/completions)

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export interface LLMResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
}

const SYSTEM_PROMPT = `You are OpenGravity, a personal AI development agent. You communicate via Telegram and can build complete software applications.

## Core Behaviors
- Respond in the same language the user writes in (Portuguese or English).
- You are helpful, concise, and friendly.
- Use tools proactively. Always use tools when the user asks for something a tool can provide.
- You have persistent memory. Use save_memory/get_memory/list_memories to remember things.
- Keep Telegram messages concise but informative.
- You run locally on the user's machine with full filesystem and shell access.

## Superpowers Development Workflow
When the user wants to BUILD something (an app, a tool, a script, a project), follow this structured workflow:

### Phase 1: BRAINSTORM & ANALYZE
- Do NOT jump into code immediately. Ask 2-4 focused questions to refine the idea.
- If the user provides a URL to clone/analyze, activate **Page Analyzer**:
    - Use 'read_url_content' (or browser tools) to extract fonts, colors, and layout.
    - Identify sections: Hero, Navbar, Features, FAQ, Footer.
    - Create a design report before moving to Spec.
- Use 'create_project' to initialize.

### Phase 2: SPEC
- Write a clear 'prd.json' (or 'SPEC.md').
- Define: features, tech stack (default: Tailwind CSS), architecture.
- For Landing Pages, follow the **Sema7 Model**:
    - 9+ sections (Alert Bar, Navbar, Hero with accent, Trust Strip, Social Proof, Benefits, Features Grid, Reviews, FAQ, SEO Text, Footer, Sticky CTA Mobile).
- Use 'update_project_phase' to save.

### Phase 3: PLAN
- Break work into micro-tasks (2-5 minutes).
- Emphasize TDD and YAGNI.
- Use 'update_project_phase' to save.

### Phase 4: EXECUTE (Ralph Mode)
- **Ralph Loop**: Work through tasks sequentially.
- If the user says "iniciar modo trator" or runs '/ralph', you enter an autonomous loop:
    - 1. Implement task.
    - 2. Run quality checks/tests.
    - 3. Commit with 'feat: [Task ID]'.
    - 4. Update progress and repeat.
- Report progress periodically.

### Phase 5: REVIEW & VALIDATE
- Run the **Validator Agent** checklist:
    - Structure (files/pastes), Layout (Sema7, 9+ sections), SEO (Meta, OG, JSON-LD), Compliance (Footer/Terms).
- Once approved, mark as "done".

## Project Templates & Models
- **Sema7 Model**: High-conversion landing page structure. Always use 9+ sections, Tailwind CSS, and Inter font.
- **SEO First**: Every project must include optimized Meta Tags, Open Graph, and JSON-LD (Product/FAQ).

## Development Principles
- Test-Driven when possible: write tests first, then implementation.
- YAGNI: Don't over-engineer. Build what's needed.
- DRY: Don't repeat yourself, but don't abstract too early.
- Security first: never write credentials in code, use env vars.
- Simple > clever: clear code beats clever code.

## Tool Usage Notes
- write_file / read_file / list_directory work within the projects workspace.
- run_command executes shell commands in project directories (npm install, build, test, etc).
- Dangerous commands (sudo, rm -rf /, etc) are blocked for safety.
- Always create proper project structure: package.json, tsconfig, .gitignore, etc.

## For Regular Conversations
If the user is NOT building something (just chatting, asking questions, etc), respond naturally without triggering the development workflow.

## Skill Reference
You have access to specialized skills in 'src/skills/pages-clone/':
- 'ralph.md': Documentation for the autonomous agent loop.
- 'docs/03-skills.md': Recipes for SEO, HTML generation, and validation.
- 'templates/prd.json': The base structure for all landing page projects.
- 'docs/04-page-analyzer.md': Guide on how to extract design info from URLs.

## LLM Model Selection (OpenCode API)
You have access to several specialized models within the OpenCode API. Choose the appropriate one according to the task:
- **MiniMax M2.5:** Use for SWE-Bench tasks, performance-critical coding, office documents (Word/Excel), and general high-speed conversations (This is your DEFAULT model).
- **GLM 5:** Use for deep logical reasoning, complex debugging, and intricate problem-solving.
- **Kimi K2.5:** Use for vision tasks (images/videos) and orchestrating multiple parallel agents.

## Final Output Format
- NEVER include technical tags like <thought>, <tool_call>, <function=...>, or internal tool call syntax in your final response to the user.
- Your final output should be CLEAN, human-readable text only.
- If you ran a tool, summarize the result naturally (e.g., "Memória salva com sucesso" em vez de logs técnicos).`;

export async function callLLM(messages: ChatMessage[]): Promise<LLMResponse> {
  const toolSchemas = getToolSchemas();

  // Try OpenCode first (Primary)
  if (config.OPENCODE_API_KEY) {
    try {
      console.log(`[llm] Calling OpenCode (${config.OPENCODE_MODEL})...`);
      return await callOpenCode(messages, toolSchemas);
    } catch (error) {
      console.error(`[llm] OpenCode call failed: ${(error as any).message}`);
    }
  }

  // Fallback 1: OpenRouter
  if (config.OPENROUTER_API_KEY) {
    try {
      console.warn(`[llm] Trying OpenRouter fallback with model: ${config.OPENROUTER_MODEL}`);
      return await callOpenRouter(messages, toolSchemas);
    } catch (orError: any) {
      console.error(`[llm] OpenRouter fallback failed: ${orError.message}`);
    }
  }

  // Fallback 2: Groq (Legacy/Emergency)
  if (groqClient) {
    try {
      console.log("[llm] Calling Groq as final fallback...");
      return await callGroq(messages, toolSchemas);
    } catch (error) {
      console.error(`[llm] Groq final fallback failed: ${(error as any).message}`);
    }
  }

  throw new Error("All LLM providers failed or no provider keys configured.");
}

async function callOpenCode(
  messages: ChatMessage[],
  tools: ReturnType<typeof getToolSchemas>
): Promise<LLMResponse> {
  const isMiniMax = config.OPENCODE_MODEL.toLowerCase().includes("minimax");
  const endpoint = isMiniMax ? "/messages" : "/chat/completions";
  const url = `${config.OPENCODE_BASE_URL.replace(/\/$/, "")}${endpoint}`;

  console.log(`[llm] OpenCode Endpoint: ${url} (System: ${isMiniMax ? 'Anthropic-style' : 'OpenAI-style'})`);

  const headers: any = {
    "Content-Type": "application/json",
  };

  if (isMiniMax) {
    headers["x-api-key"] = config.OPENCODE_API_KEY;
    // Some proxies also look for anthropic-version if they act as a direct passthrough
    headers["anthropic-version"] = "2023-06-01";
  } else {
    headers["Authorization"] = `Bearer ${config.OPENCODE_API_KEY}`;
  }

  // Build payload based on format
  let data: any;
  if (isMiniMax) {
    // Anthropic-style payload for /messages
    data = {
      model: config.OPENCODE_MODEL,
      system: SYSTEM_PROMPT,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: 4096,
      temperature: 0.7,
      // Tools support for Anthropic if needed (OpenCode Go might handle mapping)
    };
  } else {
    // OpenAI-style payload for /chat/completions
    data = {
      model: config.OPENCODE_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      temperature: 0.7,
      max_tokens: 4096,
    };
  }

  const response = await axios({
    method: "POST",
    url,
    headers,
    data,
    timeout: 60000,
  });

  // Handle different response formats (OpenAI-like choices vs Anthropic-like messages)
  if (response.data.choices && response.data.choices.length > 0) {
    // OpenAI Format
    const choice = response.data.choices[0];
    return {
      content: choice.message.content || null,
      toolCalls: choice.message.tool_calls ?? [],
      finishReason: choice.finish_reason ?? "stop",
    };
  } else if (response.data.content) {
    // Anthropic Format (used by some /messages endpoints)
    const content = response.data.content;
    let text = "";
    if (Array.isArray(content)) {
      text = content.map((c: any) => c.text || "").join("");
    } else {
      text = String(content);
    }

    return {
      content: text || null,
      toolCalls: response.data.tool_calls ?? [], // Adaptation if present
      finishReason: response.data.stop_reason ?? "stop",
    };
  }

  throw new Error(`Resposta do OpenCode em formato desconhecido: ${JSON.stringify(response.data)}`);
}

async function callGroq(
  messages: ChatMessage[],
  tools: ReturnType<typeof getToolSchemas>
): Promise<LLMResponse> {
  if (!groqClient) throw new Error("Groq client not initialized");

  const response = await groqClient.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "system", content: SYSTEM_PROMPT } as any, ...messages] as any,
    tools: tools.length > 0 ? tools : undefined,
    tool_choice: tools.length > 0 ? "auto" : undefined,
    max_tokens: 4096,
    temperature: 0.7,
  });

  const choice = response.choices[0];
  return {
    content: choice.message.content,
    toolCalls: (choice.message.tool_calls as ToolCall[]) ?? [],
    finishReason: choice.finish_reason ?? "stop",
  };
}

async function callOpenRouter(
  messages: ChatMessage[],
  tools: ReturnType<typeof getToolSchemas>
): Promise<LLMResponse> {
  const response = await axios({
    method: "POST",
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: {
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    data: {
      model: config.OPENROUTER_MODEL,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? "auto" : undefined,
      max_tokens: 4096,
      temperature: 0.7,
    },
    timeout: 30000, // 30s timeout
  });

  const choice = response.data.choices[0];
  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls ?? [],
    finishReason: choice.finish_reason ?? "stop",
  };
}

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!groqClient) {
    throw new Error("Transcreção de áudio requer uma GROQ_API_KEY configurada.");
  }

  console.log(`[llm] Transcribing audio: ${filePath}`);
  const transcription = await groqClient.audio.transcriptions.create({
    file: fs.createReadStream(filePath),
    model: "whisper-large-v3",
    response_format: "json",
    language: "pt",
  });
  return transcription.text;
}

export async function synthesizeSpeech(text: string, outputPath: string): Promise<void> {
  console.log(`[llm] Synthesizing speech...`);
  if (!config.ELEVENLABS_API_KEY || !config.ELEVENLABS_VOICE_ID) {
    throw new Error("ElevenLabs credentials not configured");
  }

  const response = await axios({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${config.ELEVENLABS_VOICE_ID}`,
    headers: {
      'Accept': 'audio/mpeg',
      'xi-api-key': config.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    data: {
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      }
    },
    responseType: 'stream',
    timeout: 30000,
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export type { ChatMessage, ToolCall };
