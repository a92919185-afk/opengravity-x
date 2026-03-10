import { registerTool } from "./registry.js";
import { config } from "../config.js";
import Exa from "exa-js";

const exa = config.EXA_API_KEY ? new Exa(config.EXA_API_KEY) : null;

function requireExa(): Exa {
  if (!exa) throw new Error("EXA_API_KEY not configured.");
  return exa;
}

// ─── exa_search ─────────────────────────────────────────────

registerTool({
  name: "exa_search",
  description:
    "Search the web using Exa AI. Returns titles, URLs, and content highlights. More powerful than search_web — supports filtering by date, domain, category (news, company, research paper, tweet, people), and returns richer content.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query.",
      },
      num_results: {
        type: "string",
        description: "Number of results to return (1-20). Defaults to 5.",
      },
      category: {
        type: "string",
        description: "Focus category: 'company', 'news', 'research paper', 'tweet', 'people', 'personal site', 'financial report'. Optional.",
        enum: ["company", "news", "research paper", "tweet", "people", "personal site", "financial report"],
      },
      include_domains: {
        type: "string",
        description: "Comma-separated list of domains to restrict results to (e.g. 'reddit.com,github.com'). Optional.",
      },
      start_date: {
        type: "string",
        description: "Only results published after this date (ISO 8601, e.g. '2025-01-01'). Optional.",
      },
    },
    required: ["query"],
  },
  execute: async (args) => {
    const client = requireExa();
    const numResults = Math.min(parseInt(args.num_results as string) || 5, 20);

    const options: any = {
      type: "auto",
      numResults,
      contents: {
        highlights: { maxCharacters: 3000 },
      },
    };

    if (args.category) options.category = args.category;
    if (args.start_date) options.startPublishedDate = args.start_date;
    if (args.include_domains) {
      options.includeDomains = (args.include_domains as string).split(",").map(d => d.trim());
    }

    const result = await client.search(args.query as string, options);

    const results = result.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      author: r.author || null,
      published: r.publishedDate || null,
      highlights: r.highlights || [],
    }));

    return JSON.stringify({ query: args.query, count: results.length, results });
  },
});

// ─── exa_get_contents ───────────────────────────────────────

registerTool({
  name: "exa_get_contents",
  description:
    "Get the full text content of one or more URLs using Exa. Better than read_url_content — returns clean markdown text, handles JavaScript-rendered pages, and provides summaries.",
  parameters: {
    type: "object",
    properties: {
      urls: {
        type: "string",
        description: "One or more URLs separated by commas.",
      },
      summary: {
        type: "string",
        description: "If 'true', also return a summary of each page. Optional.",
      },
    },
    required: ["urls"],
  },
  execute: async (args) => {
    const client = requireExa();
    const urls = (args.urls as string).split(",").map(u => u.trim());

    const contentOptions: any = {
      text: { maxCharacters: 12000 },
    };
    if (args.summary === "true") {
      contentOptions.summary = { query: "" };
    }

    const result = await client.getContents(urls, contentOptions);

    const contents = result.results.map((r: any) => ({
      url: r.url,
      title: r.title,
      text: r.text || "(no content)",
      summary: r.summary || null,
    }));

    return JSON.stringify({ count: contents.length, contents });
  },
});

// ─── exa_find_similar ───────────────────────────────────────

registerTool({
  name: "exa_find_similar",
  description:
    "Find web pages similar to a given URL. Useful for discovering related articles, competitors, or alternative sources.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The URL to find similar pages for.",
      },
      num_results: {
        type: "string",
        description: "Number of results (1-10). Defaults to 5.",
      },
    },
    required: ["url"],
  },
  execute: async (args) => {
    const client = requireExa();
    const numResults = Math.min(parseInt(args.num_results as string) || 5, 10);

    const result = await client.findSimilar(args.url as string, {
      numResults,
      contents: {
        highlights: { maxCharacters: 2000 },
      },
    });

    const results = result.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      highlights: r.highlights || [],
    }));

    return JSON.stringify({ similar_to: args.url, count: results.length, results });
  },
});

// ─── exa_company_research ───────────────────────────────────

registerTool({
  name: "exa_company_research",
  description:
    "Research a company — get business info, news, products, and insights. Uses Exa's company-focused search.",
  parameters: {
    type: "object",
    properties: {
      company: {
        type: "string",
        description: "Company name to research (e.g. 'Stripe', 'OpenAI').",
      },
    },
    required: ["company"],
  },
  execute: async (args) => {
    const client = requireExa();
    const company = args.company as string;

    const result = await client.search(company, {
      type: "auto",
      category: "company",
      numResults: 8,
      contents: {
        highlights: { maxCharacters: 3000 },
        summary: { query: `What does ${company} do?` },
      },
    });

    const results = result.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      summary: r.summary || null,
      highlights: r.highlights || [],
    }));

    return JSON.stringify({ company, count: results.length, results });
  },
});

// ─── exa_news ───────────────────────────────────────────────

registerTool({
  name: "exa_news",
  description:
    "Search for recent news articles on a topic. Returns the latest news with publication dates.",
  parameters: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The news topic to search for.",
      },
      days_back: {
        type: "string",
        description: "How many days back to search (1-30). Defaults to 7.",
      },
    },
    required: ["topic"],
  },
  execute: async (args) => {
    const client = requireExa();
    const daysBack = Math.min(parseInt(args.days_back as string) || 7, 30);
    const startDate = new Date(Date.now() - daysBack * 86400000).toISOString().split("T")[0];

    const result = await client.search(args.topic as string, {
      type: "auto",
      category: "news",
      numResults: 8,
      startPublishedDate: startDate,
      contents: {
        highlights: { maxCharacters: 2000 },
      },
    });

    const results = result.results.map((r: any) => ({
      title: r.title,
      url: r.url,
      published: r.publishedDate || null,
      highlights: r.highlights || [],
    }));

    return JSON.stringify({ topic: args.topic, days_back: daysBack, count: results.length, results });
  },
});
