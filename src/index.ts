import { config } from "./config.js";
import { createBot } from "./bot/telegram.js";
import { closeDatabase } from "./memory/database.js";
import fs from "fs";

// Register all tools
import "./tools/index.js";
import express from "express";

function startHealthCheck() {
  const app = express();
  const port = process.env.PORT || 7860;

  app.get('/', (req, res) => {
    res.send('OpenGravity Bot is Running! 🚀');
  });

  app.listen(port, () => {
    console.log(`[system] Health check server listening on port ${port}`);
  });
}

async function startBot() {
  const bot = createBot();

  // Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    bot.stop();
    closeDatabase();
    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  // Global bot error handler to prevent crash from polling errors
  bot.catch((err) => {
    console.error("[bot-error]", err.message);
  });

  console.log("[system] Entering bot loop...");
  while (true) {
    try {
      console.log("[system] Starting bot.start()...");
      await bot.start({
        onStart: (botInfo) => {
          console.log(`[bot] @${botInfo.username} is running!`);
          console.log("[bot] Waiting for messages...");
        },
      });
      console.log("[system] bot.start() finished normally.");
    } catch (error) {
      console.error("[system] Bot crashed or failed to start:", error);
      console.log("[system] Retrying in 5 seconds...");
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

async function main() {
  // Handle cloud secrets (Hugging Face / Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT && !fs.existsSync("./service-account.json")) {
    console.log("[system] Creating service-account.json from environment variable...");
    fs.writeFileSync("./service-account.json", process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  console.log("================================");
  console.log("  OpenGravity - Starting...");
  console.log("================================");
  console.log(`Allowed users: ${config.TELEGRAM_ALLOWED_USER_IDS.join(", ")}`);
  console.log(`Database: Firebase Firestore`);

  startHealthCheck();
  await startBot();
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
