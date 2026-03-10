import { registerTool } from "./registry.js";
import { config } from "../config.js";
import fs from "fs";
import path from "path";

// Project workflow states
type WorkflowPhase = "brainstorm" | "spec" | "plan" | "execute" | "review" | "done";

interface ProjectState {
  name: string;
  phase: WorkflowPhase;
  spec: string;
  plan: string[];
  completed_tasks: number[];
  created_at: string;
  updated_at: string;
}

function getProjectStatePath(projectName: string): string {
  const projectsDir = path.resolve(config.PROJECTS_DIR);
  return path.join(projectsDir, projectName, ".opengravity.json");
}

function loadProjectState(projectName: string): ProjectState | null {
  const statePath = getProjectStatePath(projectName);
  if (!fs.existsSync(statePath)) return null;
  return JSON.parse(fs.readFileSync(statePath, "utf-8"));
}

function saveProjectState(state: ProjectState): void {
  const statePath = getProjectStatePath(state.name);
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  state.updated_at = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

// ─── create_project ─────────────────────────────────────────

registerTool({
  name: "create_project",
  description:
    "Creates a new project and initializes it in the brainstorm phase. This is the first step of the Superpowers workflow. The project directory is created inside the projects workspace.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Project name (used as directory name). Use kebab-case (e.g. 'my-cool-app').",
      },
      description: {
        type: "string",
        description: "Brief description of what the user wants to build.",
      },
    },
    required: ["name", "description"],
  },
  execute: async (args) => {
    const name = (args.name as string).toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const description = args.description as string;

    const existing = loadProjectState(name);
    if (existing) {
      return JSON.stringify({
        error: `Project "${name}" already exists (phase: ${existing.phase}).`,
        hint: "Use get_project_status to see current state, or pick a different name.",
      });
    }

    const state: ProjectState = {
      name,
      phase: "brainstorm",
      spec: description,
      plan: [],
      completed_tasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveProjectState(state);

    return JSON.stringify({
      success: true,
      project: name,
      phase: "brainstorm",
      message: `Project "${name}" created. Now in brainstorm phase. Ask the user clarifying questions to refine the spec.`,
    });
  },
});

// ─── get_project_status ─────────────────────────────────────

registerTool({
  name: "get_project_status",
  description:
    "Gets the current status of a project, including its phase, spec, plan, and progress.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Project name.",
      },
    },
    required: ["name"],
  },
  execute: async (args) => {
    const name = args.name as string;
    const state = loadProjectState(name);

    if (!state) {
      return JSON.stringify({ error: `Project "${name}" not found.` });
    }

    return JSON.stringify({
      project: state.name,
      phase: state.phase,
      spec_length: state.spec.length,
      total_tasks: state.plan.length,
      completed_tasks: state.completed_tasks.length,
      progress:
        state.plan.length > 0
          ? `${state.completed_tasks.length}/${state.plan.length}`
          : "No plan yet",
      created_at: state.created_at,
      updated_at: state.updated_at,
    });
  },
});

// ─── update_project_phase ───────────────────────────────────

registerTool({
  name: "update_project_phase",
  description:
    "Advances the project to the next workflow phase. Phases: brainstorm → spec → plan → execute → review → done. You must provide the required content for each transition.",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Project name.",
      },
      phase: {
        type: "string",
        description: "The new phase to transition to.",
        enum: ["spec", "plan", "execute", "review", "done"],
      },
      spec: {
        type: "string",
        description:
          "The finalized specification document. Required when transitioning to 'spec' phase.",
      },
      plan: {
        type: "string",
        description:
          "The implementation plan as a JSON array of task description strings. Required when transitioning to 'plan' phase.",
      },
    },
    required: ["name", "phase"],
  },
  execute: async (args) => {
    const name = args.name as string;
    const newPhase = args.phase as WorkflowPhase;
    const state = loadProjectState(name);

    if (!state) {
      return JSON.stringify({ error: `Project "${name}" not found.` });
    }

    // Validate transitions
    const validTransitions: Record<WorkflowPhase, WorkflowPhase[]> = {
      brainstorm: ["spec"],
      spec: ["plan"],
      plan: ["execute"],
      execute: ["review", "execute"], // Can stay in execute
      review: ["done", "execute"], // Can go back to execute
      done: [],
    };

    if (!validTransitions[state.phase]?.includes(newPhase)) {
      return JSON.stringify({
        error: `Cannot transition from "${state.phase}" to "${newPhase}".`,
        valid: validTransitions[state.phase],
      });
    }

    if (newPhase === "spec" && args.spec) {
      state.spec = args.spec as string;
      // Also save as a file in the project
      const specPath = path.join(
        path.resolve(config.PROJECTS_DIR),
        name,
        "SPEC.md"
      );
      fs.mkdirSync(path.dirname(specPath), { recursive: true });
      fs.writeFileSync(specPath, state.spec, "utf-8");
    }

    if (newPhase === "plan" && args.plan) {
      try {
        state.plan = JSON.parse(args.plan as string);
      } catch {
        return JSON.stringify({ error: "Invalid plan format. Must be a JSON array of strings." });
      }
      // Also save as a file
      const planPath = path.join(
        path.resolve(config.PROJECTS_DIR),
        name,
        "PLAN.md"
      );
      const planContent = state.plan
        .map((task, i) => `- [ ] **Task ${i + 1}:** ${task}`)
        .join("\n");
      fs.writeFileSync(
        planPath,
        `# Implementation Plan\n\n${planContent}\n`,
        "utf-8"
      );
    }

    state.phase = newPhase;
    saveProjectState(state);

    return JSON.stringify({
      success: true,
      project: name,
      phase: newPhase,
      message: getPhaseInstructions(newPhase),
    });
  },
});

// ─── complete_task ──────────────────────────────────────────

registerTool({
  name: "complete_task",
  description:
    "Marks a task as completed in the project plan. Use the task number (1-based).",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Project name.",
      },
      task_number: {
        type: "string",
        description: "The task number to mark as complete (1-based).",
      },
    },
    required: ["name", "task_number"],
  },
  execute: async (args) => {
    const name = args.name as string;
    const taskNum = parseInt(args.task_number as string, 10);
    const state = loadProjectState(name);

    if (!state) {
      return JSON.stringify({ error: `Project "${name}" not found.` });
    }

    if (taskNum < 1 || taskNum > state.plan.length) {
      return JSON.stringify({ error: `Invalid task number. Plan has ${state.plan.length} tasks.` });
    }

    if (!state.completed_tasks.includes(taskNum)) {
      state.completed_tasks.push(taskNum);
    }

    saveProjectState(state);

    const remaining = state.plan.length - state.completed_tasks.length;
    return JSON.stringify({
      success: true,
      task: taskNum,
      description: state.plan[taskNum - 1],
      progress: `${state.completed_tasks.length}/${state.plan.length}`,
      remaining,
      all_done: remaining === 0,
    });
  },
});

// ─── list_projects ──────────────────────────────────────────

registerTool({
  name: "list_projects",
  description: "Lists all projects in the workspace.",
  parameters: {
    type: "object",
    properties: {},
  },
  execute: async () => {
    const projectsDir = path.resolve(config.PROJECTS_DIR);
    if (!fs.existsSync(projectsDir)) {
      return JSON.stringify({ projects: [], count: 0 });
    }

    const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    const projects = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => {
        const state = loadProjectState(e.name);
        return {
          name: e.name,
          phase: state?.phase ?? "unknown",
          progress: state?.plan.length
            ? `${state.completed_tasks.length}/${state.plan.length}`
            : "-",
        };
      });

    return JSON.stringify({ projects, count: projects.length });
  },
});

function getPhaseInstructions(phase: WorkflowPhase): string {
  switch (phase) {
    case "spec":
      return "Spec saved. Present the spec to the user in digestible sections for approval, then move to 'plan'.";
    case "plan":
      return "Plan saved. Present the plan tasks to the user for approval, then move to 'execute'.";
    case "execute":
      return "Execution phase. Work through each task: write code, run commands, verify. Mark tasks complete as you go.";
    case "review":
      return "All tasks done. Review the project for quality, run tests, and verify everything works.";
    case "done":
      return "Project complete!";
    default:
      return "";
  }
}
