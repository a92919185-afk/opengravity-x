import { config } from "./config.js";
import { createBot } from "./bot/telegram.js";
import { closeDatabase } from "./memory/database.js";
import { webhookCallback } from "grammy";
import fs from "fs";
import "./tools/index.js";
import express from "express";

async function main() {
  // Handle cloud secrets
  if (process.env.FIREBASE_SERVICE_ACCOUNT && !fs.existsSync("./service-account.json")) {
    fs.writeFileSync("./service-account.json", process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  console.log("OpenGravity - Iniciando...");

  const bot = createBot();

  // Graceful shutdown
  const shutdown = () => {
    bot.stop();
    closeDatabase();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  if (config.WEBHOOK_URL) {
    // --- Webhook mode (cloud) ---
    const app = express();
    const port = process.env.PORT || 7860;

    app.get("/", (_req, res) => res.send("Bot Online"));
    app.use(express.json());
    app.post("/webhook", webhookCallback(bot, "express"));

    // Start the server first (so HF sees it as "Running")
    app.listen(port, () => console.log(`[system] Webhook server on port ${port}`));

    // Try to set webhook automatically; if DNS is blocked, log manual instructions
    try {
      await bot.api.setWebhook(`${config.WEBHOOK_URL}/webhook`);
      console.log(`[bot] Webhook set to ${config.WEBHOOK_URL}/webhook`);
    } catch (err) {
      console.warn(`[bot] Could not set webhook automatically: ${err}`);
      console.warn(`[bot] Set it manually by opening in your browser:`);
      console.warn(`  https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN.slice(0, 5)}..../setWebhook?url=${config.WEBHOOK_URL}/webhook`);
      console.warn(`[bot] Server is running and will process updates once webhook is set.`);
    }
  } else {
    // --- Polling mode (local dev) ---
    const app = express();
    const port = process.env.PORT || 7860;
    app.get("/", (_req, res) => res.send("Bot Online"));
    app.listen(port, () => console.log(`[system] Health check on port ${port}`));

    // Delete webhook to enable polling
    await bot.api.deleteWebhook();

    await bot.start({
      onStart: (botInfo) => console.log(`[bot] @${botInfo.username} online! (polling)`),
    });
  }
}

main().catch((err) => {
  console.error("[system] Fatal:", err);
  process.exit(1);
});
