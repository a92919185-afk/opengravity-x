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
      console.log("[system] Deleting any existing webhooks...");
      await bot.api.deleteWebhook({ drop_pending_updates: true });

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

async function testConnectivity() {
  console.log("[debug-network] Testing DNS for api.telegram.org...");
  try {
    const { lookup } = await import("dns/promises");
    const address = await lookup("api.telegram.org");
    console.log(`[debug-network] DNS success: api.telegram.org -> ${address.address}`);
  } catch (err: any) {
    console.warn(`[debug-network] DNS FAILED for api.telegram.org: ${err.message}`);
  }

  console.log("[debug-network] Testing HTTP to google.com...");
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get("https://google.com", { timeout: 5000 });
    console.log(`[debug-network] HTTP success: google.com (status ${res.status})`);
  } catch (err: any) {
    console.warn(`[debug-network] HTTP FAILED for google.com: ${err.message}`);
  }
}

async function main() {
  // Network tests
  await testConnectivity();

  // Handle cloud secrets (Hugging Face / Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.log("[system] FIREBASE_SERVICE_ACCOUNT detected in environment.");
    if (!fs.existsSync("./service-account.json")) {
      console.log("[system] Creating service-account.json from environment variable...");
      fs.writeFileSync("./service-account.json", process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      console.log("[system] service-account.json already exists.");
    }

    // Ensure GOOGLE_APPLICATION_CREDENTIALS points to this file if not already set or if it's pointing elsewhere
    // If the user put the JSON content IN Google_Application_Credentials by mistake, this will fix it for our app
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS.includes("{")) {
      console.log("[system] Setting GOOGLE_APPLICATION_CREDENTIALS to ./service-account.json");
      process.env.GOOGLE_APPLICATION_CREDENTIALS = "./service-account.json";
    }
  }

  console.log("================================");
  console.log("  OpenGravity - Starting...");
  console.log("================================");
  console.log(`Allowed users: ${config.TELEGRAM_ALLOWED_USER_IDS.join(", ")}`);
  console.log(`Token (last 4 chars): ****${config.TELEGRAM_BOT_TOKEN.slice(-4)}`);
  console.log(`Database: Firebase Firestore`);

  startHealthCheck();
  console.log("[system] Bot process initialized. Starting bot polling...");
  await startBot();
}

main().catch((error) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
