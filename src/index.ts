import { config } from "./config.js";
import { createBot } from "./bot/telegram.js";
import { closeDatabase } from "./memory/database.js";
import "./tools/index.js";
import express from "express";
import axios from "axios";

async function main() {
  console.log("OpenGravity - Iniciando...");

  // Health check server (required by Render/cloud platforms)
  const app = express();
  const port = process.env.PORT || 10000;

  app.get("/", (_req, res) => res.send("Bot Online"));
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "opengravity-bot",
    });
  });

  app.listen(port, () => {
    console.log(`[system] Health check on port ${port}`);

    // Self-ping keep-alive mechanism
    const externalUrl = process.env.RENDER_EXTERNAL_URL;
    const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
    const baseUrl = externalUrl || (hostname ? `https://${hostname}` : null);

    if (baseUrl) {
      const healthUrl = `${baseUrl}/health`;
      console.log(`[system] Keep-alive enabled, pinging ${healthUrl} every 5 minutes`);

      setInterval(async () => {
        try {
          await axios.get(healthUrl);
          console.log(`[system] Keep-alive ping sent to ${healthUrl}`);
        } catch (err: any) {
          console.error(`[system] Keep-alive ping failed: ${err.message}`);
        }
      }, 300000);
    }
  });

  const bot = createBot();

  // Graceful shutdown
  const shutdown = () => {
    bot.stop();
    closeDatabase();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // Delete any existing webhook to allow polling
  await bot.api.deleteWebhook();

  // Start polling with retry on 409 (old instance still running during deploy)
  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await bot.start({
        onStart: (botInfo) => console.log(`[bot] @${botInfo.username} online! (polling)`),
      });
      break;
    } catch (err: any) {
      if (err?.error_code === 409 && attempt < MAX_RETRIES) {
        console.warn(`[bot] 409 conflict (attempt ${attempt}/${MAX_RETRIES}), retrying in ${attempt * 5}s...`);
        await new Promise((r) => setTimeout(r, attempt * 5000));
      } else {
        throw err;
      }
    }
  }
}

main().catch((err) => {
  console.error("[system] Fatal:", err);
  process.exit(1);
});
