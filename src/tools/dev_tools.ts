import { registerTool } from "./registry.js";
import { config } from "../config.js";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Ensure projects directory exists
function getProjectsDir(): string {
  const dir = path.resolve(config.PROJECTS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Security: resolve path and ensure it's within projects dir
function safePath(filePath: string): string {
  const projectsDir = getProjectsDir();
  const resolved = path.resolve(projectsDir, filePath);
  if (!resolved.startsWith(projectsDir)) {
    throw new Error("Path traversal detected. Access denied.");
  }
  return resolved;
}

// ─── Security: command allowlist ─────────────────────────────
// Only these commands (first word) are allowed to run.
// Anything not on this list is blocked by default.
const ALLOWED_COMMANDS = new Set([
  // Node / JS
  "npm", "npx", "node", "yarn", "pnpm", "bun", "tsc", "tsx", "eslint", "prettier",
  // Python
  "python", "python3", "pip", "pip3", "poetry", "uv", "uvx",
  // Git
  "git",
  // General dev
  "make", "cargo", "go", "docker", "docker-compose",
  // Safe file ops (will be further restricted to projects dir)
  "ls", "cat", "head", "tail", "find", "grep", "wc", "sort", "uniq", "diff",
  "mkdir", "cp", "mv", "touch", "echo", "printf", "tree", "which", "env",
  // Build / test
  "jest", "vitest", "mocha", "pytest",
]);

// Extra blocked patterns as a second layer of defense
const BLOCKED_PATTERNS = [
  /\brm\s+-rf\s+[\/~]/i,
  /\bsudo\b/i,
  /\bcurl\b.*\|\s*\b(bash|sh)\b/i,
  /\bwget\b.*\|\s*\b(bash|sh)\b/i,
  /\bchmod\b.*777/i,
  /\bdd\b\s+if=/i,
  /\bmkfs\b/i,
  /\b:\(\)\{/i,
  /\bformat\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bkill\b/i,
  /\bkillall\b/i,
  /\bpasswd\b/i,
  /\buseradd\b/i,
  /\buserdel\b/i,
  /\/etc\//i,
  /\/proc\//i,
  /\/sys\//i,
  /\/dev\//i,
  /~\//,
  /\$HOME/i,
  /\$\{?ENV\b/i,
  /\bexport\b/i,
  /\bsource\b/i,
  /\beval\b/i,
  /`[^`]*`/,           // backtick subshells
  /\$\([^)]*\)/,       // $() subshells
];

// Extract the base command (first word, ignoring env vars like KEY=val)
function getBaseCommand(command: string): string {
  const parts = command.trim().split(/\s+/);
  // Skip leading env var assignments (e.g. NODE_ENV=production npm run build)
  for (const part of parts) {
    if (!part.includes("=")) return part;
  }
  return parts[0];
}

// ─── Security: sanitized env for child processes ─────────────
// Only pass safe env vars — never leak API keys, tokens, or secrets.
function getSafeEnv(): Record<string, string> {
  const safe: Record<string, string> = {
    NODE_ENV: "development",
    PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME || "/tmp",
    LANG: process.env.LANG || "en_US.UTF-8",
    TERM: process.env.TERM || "xterm-256color",
    SHELL: process.env.SHELL || "/bin/bash",
    USER: process.env.USER || "user",
  };

  // Pass npm config vars (needed for npm install/build)
  for (const [key, val] of Object.entries(process.env)) {
    if (key.startsWith("npm_config_") && val) {
      safe[key] = val;
    }
  }

  return safe;
}

// ─── write_file ─────────────────────────────────────────────

registerTool({
  name: "write_file",
  description:
    "Creates or overwrites a file inside the projects workspace. Automatically creates parent directories. Use for writing code, configs, specs, plans, etc.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description:
          "Relative path from projects root (e.g. 'my-app/src/index.ts').",
      },
      content: {
        type: "string",
        description: "The full content to write to the file.",
      },
    },
    required: ["file_path", "content"],
  },
  execute: async (args) => {
    const filePath = safePath(args.file_path as string);
    const content = args.content as string;

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");

    return JSON.stringify({
      success: true,
      path: path.relative(getProjectsDir(), filePath),
      size: content.length,
    });
  },
});

// ─── read_file ──────────────────────────────────────────────

registerTool({
  name: "read_file",
  description:
    "Reads a file from the projects workspace. Returns the file content.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Relative path from projects root.",
      },
    },
    required: ["file_path"],
  },
  execute: async (args) => {
    const filePath = safePath(args.file_path as string);

    if (!fs.existsSync(filePath)) {
      return JSON.stringify({ error: "File not found", path: args.file_path });
    }

    const stat = fs.statSync(filePath);
    if (stat.size > 100_000) {
      return JSON.stringify({
        error: "File too large (>100KB). Read a specific section instead.",
      });
    }

    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.stringify({
      path: args.file_path,
      content,
      size: content.length,
    });
  },
});

// ─── list_directory ─────────────────────────────────────────

registerTool({
  name: "list_directory",
  description:
    "Lists files and directories in a path within the projects workspace. Shows type (file/dir) and size.",
  parameters: {
    type: "object",
    properties: {
      dir_path: {
        type: "string",
        description:
          "Relative path from projects root. Use '.' or empty for root.",
      },
    },
  },
  execute: async (args) => {
    const dirPath = safePath((args.dir_path as string) || ".");

    if (!fs.existsSync(dirPath)) {
      return JSON.stringify({ error: "Directory not found", path: args.dir_path });
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = entries
      .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
      .map((e) => {
        const fullPath = path.join(dirPath, e.name);
        if (e.isDirectory()) {
          return { name: e.name, type: "dir" };
        }
        const stat = fs.statSync(fullPath);
        return { name: e.name, type: "file", size: stat.size };
      });

    return JSON.stringify({
      path: (args.dir_path as string) || ".",
      entries: items,
      count: items.length,
    });
  },
});

// ─── create_directory ───────────────────────────────────────

registerTool({
  name: "create_directory",
  description: "Creates a directory (and parent directories) in the projects workspace.",
  parameters: {
    type: "object",
    properties: {
      dir_path: {
        type: "string",
        description: "Relative path from projects root.",
      },
    },
    required: ["dir_path"],
  },
  execute: async (args) => {
    const dirPath = safePath(args.dir_path as string);
    fs.mkdirSync(dirPath, { recursive: true });
    return JSON.stringify({
      success: true,
      path: path.relative(getProjectsDir(), dirPath),
    });
  },
});

// ─── delete_file ────────────────────────────────────────────

registerTool({
  name: "delete_file",
  description: "Deletes a file from the projects workspace.",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Relative path from projects root.",
      },
    },
    required: ["file_path"],
  },
  execute: async (args) => {
    const filePath = safePath(args.file_path as string);

    if (!fs.existsSync(filePath)) {
      return JSON.stringify({ error: "File not found" });
    }

    fs.unlinkSync(filePath);
    return JSON.stringify({ success: true, deleted: args.file_path });
  },
});

// ─── run_command ────────────────────────────────────────────

registerTool({
  name: "run_command",
  description:
    "Executes a shell command inside a project directory. Use for npm install, npm run build, git init, running tests, etc. Commands are sandboxed to the projects workspace. Dangerous commands are blocked.",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The shell command to execute.",
      },
      working_dir: {
        type: "string",
        description:
          "Relative path from projects root to use as working directory. Defaults to projects root.",
      },
    },
    required: ["command"],
  },
  execute: async (args) => {
    const command = args.command as string;
    const workDir = safePath((args.working_dir as string) || ".");

    // Layer 1: Allowlist — only known-safe commands can run
    const baseCmd = getBaseCommand(command);
    if (!ALLOWED_COMMANDS.has(baseCmd)) {
      return JSON.stringify({
        error: `Command not allowed: "${baseCmd}". Only development tools are permitted (npm, git, node, python, etc).`,
        command,
      });
    }

    // Layer 2: Block dangerous patterns (even within allowed commands)
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return JSON.stringify({
          error: "Command blocked for security reasons.",
          command,
        });
      }
    }

    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    try {
      const output = execSync(command, {
        cwd: workDir,
        timeout: 120_000, // 2 minutes max
        maxBuffer: 1024 * 1024, // 1MB
        encoding: "utf-8",
        env: getSafeEnv(),
      });

      const trimmed = output.length > 3000 ? output.slice(-3000) + "\n...(truncated)" : output;
      return JSON.stringify({ success: true, output: trimmed });
    } catch (error: any) {
      const stderr = error.stderr?.slice?.(-2000) || "";
      const stdout = error.stdout?.slice?.(-1000) || "";
      return JSON.stringify({
        success: false,
        exit_code: error.status,
        stderr,
        stdout,
      });
    }
  },
});

// ─── search_files ───────────────────────────────────────────

registerTool({
  name: "search_files",
  description:
    "Searches for a text pattern in files within the projects workspace. Returns matching lines with file paths and line numbers.",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "Text or regex pattern to search for.",
      },
      dir_path: {
        type: "string",
        description: "Relative path to search in. Defaults to projects root.",
      },
      file_glob: {
        type: "string",
        description: "File glob pattern to filter (e.g. '*.ts', '*.py'). Defaults to all files.",
      },
    },
    required: ["pattern"],
  },
  execute: async (args) => {
    const searchDir = safePath((args.dir_path as string) || ".");
    const pattern = args.pattern as string;
    const glob = (args.file_glob as string) || "*";

    if (!fs.existsSync(searchDir)) {
      return JSON.stringify({ error: "Directory not found" });
    }

    try {
      const cmd = `grep -rn --include="${glob}" "${pattern.replace(/"/g, '\\"')}" . 2>/dev/null | head -50`;
      const output = execSync(cmd, {
        cwd: searchDir,
        timeout: 15_000,
        encoding: "utf-8",
        maxBuffer: 512 * 1024,
        env: getSafeEnv(),
      });

      const lines = output.trim().split("\n").filter(Boolean);
      return JSON.stringify({
        matches: lines.length,
        results: lines,
      });
    } catch {
      return JSON.stringify({ matches: 0, results: [] });
    }
  },
});
