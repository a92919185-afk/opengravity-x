import { type ModelKey } from "../llm/parallel.js";

// ─── Smart Router ────────────────────────────────────────────────
// Analyzes user messages and selects the best model(s) for the task.
// Returns one or more model keys depending on whether parallel execution is beneficial.

export interface RouteDecision {
  primary: ModelKey;
  parallel: ModelKey[] | null;  // null = single model, array = run in parallel
  reason: string;
}

// ─── Keyword / pattern matchers ──────────────────────────────────

const REASONING_PATTERNS = [
  /debug/i, /bug/i, /erro/i, /error/i, /por\s?qu[eê]/i, /why/i,
  /expli(que|ca)/i, /explain/i, /analis[ea]/i, /analyz/i, /analys/i,
  /compar[ea]/i, /compare/i, /logic[ao]/i, /logic/i,
  /calcul[ea]/i, /calculat/i, /mat[eé]m/i, /math/i,
  /complex/i, /dif[ií]cil/i, /difficult/i, /profund/i, /deep/i,
  /refactor/i, /otimiz/i, /optimiz/i, /archite/i, /arquitet/i,
  /algorithm/i, /algoritmo/i, /proof/i, /prova/i,
];

const VISION_PATTERNS = [
  /image[mn]/i, /foto/i, /photo/i, /screenshot/i, /print/i,
  /v[ií]deo/i, /video/i, /visual/i, /veja\s+(isso|esta|este)/i,
  /look\s+at/i, /olh[ea]/i, /tela/i, /screen/i,
  /diagram/i, /gr[aá]fico/i, /chart/i, /graph/i,
  /desenh/i, /draw/i, /ui\b/i, /design/i, /layout/i,
];

const RESEARCH_PATTERNS = [
  /pesquis/i, /research/i, /investig/i, /busca/i, /search/i,
  /encontr[ea]/i, /find/i, /compar[ea].*(?:produto|servi|empresa|ferramenta)/i,
  /compare.*(?:product|service|company|tool)/i,
  /pros?\s+(?:e|and)\s+contras?/i, /pros?\s+(?:and)\s+cons?/i,
  /resum[oa]/i, /summar/i, /overview/i, /vis[aã]o\s+geral/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// ─── Route decision logic ────────────────────────────────────────

export function routeMessage(userMessage: string): RouteDecision {
  const msg = userMessage.trim();

  const isReasoning = matchesAny(msg, REASONING_PATTERNS);
  const isVision = matchesAny(msg, VISION_PATTERNS);
  const isResearch = matchesAny(msg, RESEARCH_PATTERNS);

  // Vision tasks → kimi
  if (isVision && !isReasoning && !isResearch) {
    return {
      primary: "kimi",
      parallel: null,
      reason: "Tarefa visual detectada — usando Kimi (especialista em visão).",
    };
  }

  // Deep reasoning → glm5
  if (isReasoning && !isVision && !isResearch) {
    return {
      primary: "glm5",
      parallel: null,
      reason: "Tarefa de raciocínio complexo — usando GLM5 (raciocínio profundo).",
    };
  }

  // Research that benefits from multiple perspectives → parallel
  if (isResearch) {
    return {
      primary: "minimax",
      parallel: ["minimax", "glm5"],
      reason: "Pesquisa detectada — consultando MiniMax e GLM5 em paralelo para melhor cobertura.",
    };
  }

  // Vision + reasoning → kimi primary, glm5 parallel
  if (isVision && isReasoning) {
    return {
      primary: "kimi",
      parallel: ["kimi", "glm5"],
      reason: "Tarefa visual + raciocínio — Kimi (visão) e GLM5 (lógica) em paralelo.",
    };
  }

  // Default → minimax (fast, general-purpose)
  return {
    primary: "minimax",
    parallel: null,
    reason: "Tarefa geral — usando MiniMax (rápido e versátil).",
  };
}

// ─── Decide if parallel execution is worth it ────────────────────
// Short messages (greetings, simple questions) don't need parallel.
export function shouldUseParallel(userMessage: string): boolean {
  const msg = userMessage.trim();
  // Too short — probably a greeting or simple answer
  if (msg.length < 30) return false;
  // Check if the route suggests parallel
  const route = routeMessage(msg);
  return route.parallel !== null;
}
