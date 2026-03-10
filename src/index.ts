import { config } from "./config.js";
import { createBot } from "./bot/telegram.js";
import { closeDatabase } from "./memory/database.js";
import fs from "fs";
import "./tools/index.js";
import express from "express";

function startHealthCheck() {
  const app = express();
  const port = process.env.PORT || 7860;
  app.get('/', (req, res) => res.send('Bot Online 🚀'));
  app.listen(port, () => console.log(`[system] Health check on port ${port}`));
}

async function main() {
  // Handle cloud secrets
  if (process.env.FIREBASE_SERVICE_ACCOUNT && !fs.existsSync("./service-account.json")) {
    fs.writeFileSync("./service-account.json", process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  console.log("OpenGravity - Iniciando...");
  startHealthCheck();

  const bot = createBot();

  // Graceful shutdown
  const shutdown = () => {
    bot.stop();
    closeDatabase();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    await bot.start({
      onStart: (botInfo) => console.log(`[bot] @${botInfo.username} online!`),
    });
  } catch (error) {
    console.error("[system] Bot Error:", error);
    process.exit(1);
  }
}

main().catch(console.error);
