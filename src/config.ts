import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
  TELEGRAM_ALLOWED_USER_IDS: z
    .string()
    .min(1, "TELEGRAM_ALLOWED_USER_IDS is required")
    .transform((val) =>
      val.split(",").map((id) => {
        const parsed = parseInt(id.trim(), 10);
        if (isNaN(parsed)) throw new Error(`Invalid user ID: ${id}`);
        return parsed;
      })
    ),
  GROQ_API_KEY: z.string().optional(),
  OPENCODE_API_KEY: z.string().optional(),
  OPENCODE_BASE_URL: z.string().default("https://opencode.ai/zen/go/v1"),
  OPENCODE_MODEL: z.string().default("minimax-m2.5"),
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_MODEL: z.string().default("google/gemini-2.0-flash-001"),
  TAVILY_API_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  PROJECTS_DIR: z.string().default("./projects"),
});


const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = parsed.data;
