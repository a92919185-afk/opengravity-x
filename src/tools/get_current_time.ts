import { registerTool } from "./registry.js";

registerTool({
  name: "get_current_time",
  description:
    "Returns the current date and time. Optionally accepts a timezone (IANA format, e.g. 'America/Sao_Paulo').",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "IANA timezone identifier (e.g. 'America/Sao_Paulo', 'UTC'). Defaults to 'America/Sao_Paulo'.",
      },
    },
  },
  execute: async (args) => {
    const timezone = (args.timezone as string) || "America/Sao_Paulo";

    try {
      const now = new Date();
      const formatted = now.toLocaleString("pt-BR", {
        timeZone: timezone,
        dateStyle: "full",
        timeStyle: "long",
      });

      return JSON.stringify({
        formatted,
        iso: now.toISOString(),
        timezone,
        unix: Math.floor(now.getTime() / 1000),
      });
    } catch {
      return JSON.stringify({ error: `Timezone inválido: ${timezone}` });
    }
  },
});
