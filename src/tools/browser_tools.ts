import { registerTool } from "./registry.js";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Each user gets their own browser session to prevent state conflicts
function getSessionName(userId?: number): string {
  return userId ? `user-${userId}` : "default";
}

async function runBrowserUse(userId: number | undefined, ...args: string[]): Promise<string> {
  const session = getSessionName(userId);
  try {
    const { stdout, stderr } = await execFileAsync(
      "browser-use",
      ["--session", session, ...args],
      { timeout: 30_000, maxBuffer: 1024 * 1024 },
    );
    return stdout || stderr || "(no output)";
  } catch (error: any) {
    return error.stdout || error.stderr || error.message;
  }
}

function uid(args: Record<string, unknown>): number | undefined {
  return args.__userId as number | undefined;
}

// ─── browser_open ───────────────────────────────────────────

registerTool({
  name: "browser_open",
  description:
    "Opens a URL in a headless browser. Use this to navigate to websites for interaction or data extraction.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to open." },
    },
    required: ["url"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "open", args.url as string);
    return JSON.stringify({ action: "open", url: args.url, result });
  },
});

// ─── browser_state ──────────────────────────────────────────

registerTool({
  name: "browser_state",
  description:
    "Returns the current page URL, title, and all interactive elements with their indices. Use this to see what's on the page before interacting.",
  parameters: { type: "object", properties: {} },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "state");
    return result;
  },
});

// ─── browser_click ──────────────────────────────────────────

registerTool({
  name: "browser_click",
  description:
    "Clicks an element on the page by its index. Use browser_state first to see available elements and their indices.",
  parameters: {
    type: "object",
    properties: {
      index: { type: "string", description: "The index number of the element to click (from browser_state)." },
    },
    required: ["index"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "click", args.index as string);
    return JSON.stringify({ action: "click", index: args.index, result });
  },
});

// ─── browser_input ──────────────────────────────────────────

registerTool({
  name: "browser_input",
  description:
    "Clicks an input element by index and types text into it. Use browser_state first to find the element index.",
  parameters: {
    type: "object",
    properties: {
      index: { type: "string", description: "The index of the input element (from browser_state)." },
      text: { type: "string", description: "The text to type into the element." },
    },
    required: ["index", "text"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "input", args.index as string, args.text as string);
    return JSON.stringify({ action: "input", index: args.index, text: args.text, result });
  },
});

// ─── browser_type ───────────────────────────────────────────

registerTool({
  name: "browser_type",
  description: "Types text into the currently focused element on the page.",
  parameters: {
    type: "object",
    properties: {
      text: { type: "string", description: "The text to type." },
    },
    required: ["text"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "type", args.text as string);
    return JSON.stringify({ action: "type", text: args.text, result });
  },
});

// ─── browser_keys ───────────────────────────────────────────

registerTool({
  name: "browser_keys",
  description: "Sends keyboard keys or key combinations (e.g. 'Enter', 'Control+a', 'Tab').",
  parameters: {
    type: "object",
    properties: {
      keys: { type: "string", description: "The key or key combination to send (e.g. 'Enter', 'Control+a')." },
    },
    required: ["keys"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "keys", args.keys as string);
    return JSON.stringify({ action: "keys", keys: args.keys, result });
  },
});

// ─── browser_screenshot ─────────────────────────────────────

registerTool({
  name: "browser_screenshot",
  description: "Takes a screenshot of the current page and saves it to a file. Returns the file path.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to save the screenshot. Defaults to '/tmp/browser_screenshot.png'." },
    },
  },
  execute: async (args) => {
    const filePath = (args.path as string) || "/tmp/browser_screenshot.png";
    const result = await runBrowserUse(uid(args), "screenshot", filePath);
    return JSON.stringify({ action: "screenshot", path: filePath, result });
  },
});

// ─── browser_scroll ─────────────────────────────────────────

registerTool({
  name: "browser_scroll",
  description: "Scrolls the page up or down to reveal more content.",
  parameters: {
    type: "object",
    properties: {
      direction: { type: "string", description: "Scroll direction: 'up' or 'down'.", enum: ["up", "down"] },
    },
    required: ["direction"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "scroll", args.direction as string);
    return JSON.stringify({ action: "scroll", direction: args.direction, result });
  },
});

// ─── browser_eval ───────────────────────────────────────────

registerTool({
  name: "browser_eval",
  description: "Executes JavaScript code on the current page and returns the result.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "JavaScript code to execute in the browser context." },
    },
    required: ["code"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "eval", args.code as string);
    return JSON.stringify({ action: "eval", result });
  },
});

// ─── browser_select ─────────────────────────────────────────

registerTool({
  name: "browser_select",
  description: "Selects an option from a dropdown element by its index.",
  parameters: {
    type: "object",
    properties: {
      index: { type: "string", description: "The index of the dropdown element (from browser_state)." },
      option: { type: "string", description: "The option text to select." },
    },
    required: ["index", "option"],
  },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "select", args.index as string, args.option as string);
    return JSON.stringify({ action: "select", index: args.index, option: args.option, result });
  },
});

// ─── browser_back ───────────────────────────────────────────

registerTool({
  name: "browser_back",
  description: "Navigates back to the previous page in browser history.",
  parameters: { type: "object", properties: {} },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "back");
    return JSON.stringify({ action: "back", result });
  },
});

// ─── browser_close ──────────────────────────────────────────

registerTool({
  name: "browser_close",
  description: "Closes the browser session. Always call this when done with browser tasks to free resources.",
  parameters: { type: "object", properties: {} },
  execute: async (args) => {
    const result = await runBrowserUse(uid(args), "close");
    return JSON.stringify({ action: "close", result });
  },
});
