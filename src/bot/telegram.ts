import { Bot, type Context, InputFile } from "grammy";
import { config } from "../config.js";
import { runAgentLoop } from "../agent/loop.js";
import { clearConversationHistory } from "../memory/memory.js";
import { transcribeAudio, synthesizeSpeech } from "../llm/provider.js";
import { setNotifyFn } from "../agent/taskqueue.js";
import { setProgressNotifyFn } from "../agent/progress.js";
import path from "path";
import fs from "fs";
import os from "os";
import { pipeline } from "stream/promises";
import axios from "axios";

export function createBot(): Bot {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  const allowedUserIds = new Set(config.TELEGRAM_ALLOWED_USER_IDS);

  // ─── Shared notification sender (used by taskqueue + progress) ───
  const sendNotification = async (userId: number, message: string) => {
    try {
      const chunks = splitMessage(message, 4096);
      for (const chunk of chunks) {
        await sendHTML(
          async (t, pm) => {
            await bot.api.sendMessage(userId, t, pm ? { parse_mode: pm as any } : undefined);
          },
          chunk,
        );
      }
    } catch (err) {
      console.error(`[notify] Failed to notify user ${userId}:`, err);
    }
  };

  // Connect progress tracker to Telegram
  setProgressNotifyFn(sendNotification);

  // Connect background task notifications to Telegram
  setNotifyFn(sendNotification);

  // Security middleware: whitelist check
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !allowedUserIds.has(userId)) {
      console.warn(`[security] Blocked message from unauthorized user: ${userId}`);
      return; // Silently ignore
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "OpenGravity ativo. Envie qualquer mensagem para conversar comigo."
    );
  });

  // /clear command to reset conversation
  bot.command("clear", async (ctx) => {
    const userId = ctx.from!.id;
    await clearConversationHistory(userId);
    await ctx.reply("Histórico de conversa limpo.");
  });

  // Handle all text messages
  bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text;

    console.log(`[msg] User ${userId}: ${text.substring(0, 100)}`);

    // Show typing indicator
    await ctx.replyWithChatAction("typing");

    try {
      const response = await runAgentLoop(userId, text);
      console.log(`[telegram] Sending response to user ${userId} (${response.length} chars)`);
      await sendLongMessage(ctx, response);
      console.log(`[telegram] Response sent successfully.`);
    } catch (error) {
      console.error("[error] Agent loop failed:", error);
      await ctx.reply(
        "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."
      );
    }
  });

  // Handle all voice messages
  bot.on("message:voice", async (ctx) => {
    const userId = ctx.from.id;

    console.log(`[voice] User ${userId} sent an audio message.`);
    await ctx.replyWithChatAction("record_voice");

    const tempDir = os.tmpdir();
    const voice = ctx.message.voice;
    const file = await ctx.getFile();
    const filePath = path.join(tempDir, `voice_${voice.file_unique_id}.ogg`);

    try {
      // Download the file
      const fileUrl = `https://api.telegram.org/file/bot${config.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
      const response = await axios({
        url: fileUrl,
        method: 'GET',
        responseType: 'stream'
      });
      await pipeline(response.data, fs.createWriteStream(filePath));

      // Transcribe
      await ctx.replyWithChatAction("typing");
      const transcription = await transcribeAudio(filePath);
      console.log(`[voice] Transcribed: ${transcription}`);
      await ctx.reply(`🎤 *Transcrição:* _${transcription}_`, { parse_mode: "Markdown" });

      // Run through agent loop
      const agentResponse = await runAgentLoop(userId, transcription);

      // Reply with Text first
      await sendLongMessage(ctx, agentResponse);

      // Synthesis: Reply with Voice
      try {
        await ctx.replyWithChatAction("record_voice");
        const audioOutputPath = path.join(tempDir, `reply_${voice.file_unique_id}.mp3`);
        await synthesizeSpeech(agentResponse, audioOutputPath);
        await ctx.replyWithVoice(new InputFile(audioOutputPath));
        if (fs.existsSync(audioOutputPath)) fs.unlinkSync(audioOutputPath);
      } catch (ttsError) {
        console.error("[tts] Failed to synthesize or send voice:", ttsError);
      }

    } catch (error) {
      console.error("[error] Voice processing failed:", error);
      await ctx.reply("Desculpe, não consegui processar seu áudio. Verifique se ele está claro.");
    } finally {
      // Cleanup
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  // Error handler
  bot.catch((err) => {
    console.error("[bot] Error:", err.message);
  });

  return bot;
}

// ─── Markdown → Telegram HTML converter ──────────────────────────

function markdownToTelegramHTML(text: string): string {
  // 1. Escape HTML special chars FIRST (but not in code blocks)
  // Extract code blocks, escape the rest, then put code blocks back
  const codeBlocks: string[] = [];

  // Preserve ```code blocks```
  let processed = text.replace(/```([\s\S]*?)```/g, (_match, code) => {
    codeBlocks.push(code);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // Preserve `inline code`
  const inlineCodes: string[] = [];
  processed = processed.replace(/`([^`]+)`/g, (_match, code) => {
    inlineCodes.push(code);
    return `%%INLINE_${inlineCodes.length - 1}%%`;
  });

  // Escape HTML entities in remaining text
  processed = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 2. Convert markdown formatting to HTML
  // **bold** or __bold__ → <b>bold</b>
  processed = processed.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  processed = processed.replace(/__(.+?)__/g, "<b>$1</b>");

  // *italic* or _italic_ (but not inside words like file_name)
  processed = processed.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "<i>$1</i>");
  processed = processed.replace(/(?<!\w)_(.+?)_(?!\w)/g, "<i>$1</i>");

  // ~~strikethrough~~ → <s>strikethrough</s>
  processed = processed.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // 3. Restore code blocks
  processed = processed.replace(/%%CODEBLOCK_(\d+)%%/g, (_match, idx) => {
    return `<pre>${codeBlocks[parseInt(idx)].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`;
  });

  processed = processed.replace(/%%INLINE_(\d+)%%/g, (_match, idx) => {
    return `<code>${inlineCodes[parseInt(idx)].replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`;
  });

  return processed;
}

// ─── Safe HTML send: falls back to plain text if parse fails ─────

async function sendHTML(
  sendFn: (text: string, parseMode?: string) => Promise<void>,
  text: string,
): Promise<void> {
  const html = markdownToTelegramHTML(text);
  try {
    await sendFn(html, "HTML");
  } catch (err: any) {
    // If HTML parsing fails (bad tags), fallback to plain text
    if (err?.error_code === 400 && err?.description?.includes("parse")) {
      console.warn("[telegram] HTML parse failed, sending as plain text");
      await sendFn(text);
    } else {
      throw err;
    }
  }
}

// ─── Send long messages with HTML formatting ─────────────────────

async function sendLongMessage(ctx: Context, text: string): Promise<void> {
  const MAX_LENGTH = 4096;
  const chunks = splitMessage(text, MAX_LENGTH);

  console.log(`[telegram] Sending ${chunks.length} chunk(s) with HTML formatting.`);
  for (const chunk of chunks) {
    await sendHTML(
      async (t, pm) => { await ctx.reply(t, pm ? { parse_mode: pm as any } : undefined); },
      chunk,
    );
  }
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}
