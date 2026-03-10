import { registerTool } from "./registry.js";
import {
  saveMemory,
  getMemory,
  deleteMemory,
  listMemories,
} from "../memory/memory.js";

registerTool({
  name: "save_memory",
  description:
    "Saves a piece of information to persistent memory. Use this to remember facts, preferences, or anything the user asks you to remember.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "A short identifier for this memory (e.g. 'user_name', 'favorite_language').",
      },
      value: {
        type: "string",
        description: "The content to remember.",
      },
    },
    required: ["key", "value"],
  },
  execute: async (args) => {
    const key = args.key as string;
    const value = args.value as string;
    await saveMemory(key, value);
    return JSON.stringify({ success: true, message: `Memory saved: "${key}"` });
  },
});

registerTool({
  name: "get_memory",
  description: "Retrieves a specific memory by its key.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "The key of the memory to retrieve.",
      },
    },
    required: ["key"],
  },
  execute: async (args) => {
    const key = args.key as string;
    const value = await getMemory(key);
    if (value === null) {
      return JSON.stringify({ found: false, message: `No memory found for key: "${key}"` });
    }
    return JSON.stringify({ found: true, key, value });
  },
});

registerTool({
  name: "delete_memory",
  description: "Deletes a specific memory by its key.",
  parameters: {
    type: "object",
    properties: {
      key: {
        type: "string",
        description: "The key of the memory to delete.",
      },
    },
    required: ["key"],
  },
  execute: async (args) => {
    const key = args.key as string;
    const deleted = await deleteMemory(key);
    return JSON.stringify({
      success: deleted,
      message: deleted ? `Memory deleted: "${key}"` : `No memory found for key: "${key}"`,
    });
  },
});

registerTool({
  name: "list_memories",
  description: "Lists all saved memories.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const memories = await listMemories();
    if (memories.length === 0) {
      return JSON.stringify({ count: 0, message: "No memories saved yet." });
    }
    return JSON.stringify({
      count: memories.length,
      memories: memories.map((m) => ({
        key: m.key,
        value: m.value,
        updated_at: m.updated_at,
      })),
    });
  },
});
