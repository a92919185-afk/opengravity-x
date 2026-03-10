import { Bot, type Context, InputFile } from "grammy";
import { config } from "../config.js";
import { runAgentLoop } from "../agent/loop.js";
import { clearConversationHistory } from "../memory/memory.js";
import { transcribeAudio, synthesizeSpeech } from "../llm/provider.js";
import path from "path";
import fs from "fs";
import os from "os";
import { pipeline } from "stream/promises";
import axios from "axios";

export function createBot(): Bot {
  const bot = new Bot(config.TELEGRAM_BOT_TOKEN);
  const allowedUserIds = new Set(config.TELEGRAM_ALLOWED_USER_IDS);

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

  // /ping command
  bot.command("ping", async (ctx) => {
    await ctx.reply("PONG! O bot no Hugging Face está ativo. 🏓");
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

async function sendLongMessage(ctx: Context, text: string): Promise<void> {
  const MAX_LENGTH = 4096;

  if (text.length <= MAX_LENGTH) {
    await ctx.reply(text);
    return;
  }

  // Split into chunks at line breaks when possible
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = remaining.lastIndexOf("\n", MAX_LENGTH);
    if (splitIndex === -1 || splitIndex < MAX_LENGTH / 2) {
      splitIndex = remaining.lastIndexOf(" ", MAX_LENGTH);
    }
    if (splitIndex === -1) {
      splitIndex = MAX_LENGTH;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  console.log(`[telegram] Message split into ${chunks.length} chunks.`);
  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}
