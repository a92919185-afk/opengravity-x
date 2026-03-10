import { config } from "./config.js";
import { createBot } from "./bot/telegram.js";
import { closeDatabase } from "./memory/database.js";
import "./tools/index.js";

async function main() {
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

  // --- Polling mode (local dev) ---
  console.log("[system] Starting bot in polling mode...");

  // Ensure we delete any existing webhooks to allow polling
  await bot.api.deleteWebhook();

  await bot.start({
    onStart: (botInfo) => console.log(`[bot] @${botInfo.username} online! (polling)`),
  });
}

main().catch((err) => {
  console.error("[system] Fatal:", err);
  process.exit(1);
});

