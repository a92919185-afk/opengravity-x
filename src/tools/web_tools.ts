import { registerTool } from "./registry.js";
import { config } from "../config.js";
import axios from "axios";
import { convert } from "html-to-text";

// ─── search_web ─────────────────────────────────────────────

registerTool({
    name: "search_web",
    description:
        "Performs a web search using Tavily API. Returns titles, URLs, and snippets of relevant websites.",
    parameters: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query to perform.",
            },
        },
        required: ["query"],
    },
    execute: async (args) => {
        if (!config.TAVILY_API_KEY) {
            return JSON.stringify({ error: "TAVILY_API_KEY not configured." });
        }

        try {
            const response = await axios.post("https://api.tavily.com/search", {
                api_key: config.TAVILY_API_KEY,
                query: args.query,
                search_depth: "basic",
                max_results: 5,
            });

            return JSON.stringify(response.data.results);
        } catch (error: any) {
            return JSON.stringify({
                error: "Failed to search web",
                details: error.message,
            });
        }
    },
});

// ─── read_url_content ───────────────────────────────────────

registerTool({
    name: "read_url_content",
    description:
        "Fetches the content of a URL and converts it to clean text. Use this to analyze websites, documents, or articles.",
    parameters: {
        type: "object",
        properties: {
            url: {
                type: "string",
                description: "The URL to read.",
            },
        },
        required: ["url"],
    },
    execute: async (args) => {
        const url = args.url as string;

        try {
            const response = await axios.get(url, {
                timeout: 15e3,
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                },
            });

            const text = convert(response.data, {
                wordwrap: 130,
                selectors: [
                    { selector: "a", options: { ignoreHref: true } },
                    { selector: "img", format: "skip" },
                    { selector: "nav", format: "skip" },
                    { selector: "footer", format: "skip" },
                    { selector: "script", format: "skip" },
                    { selector: "style", format: "skip" },
                ],
            });

            // Truncate to avoid context window issues
            const truncated = text.length > 15000 ? text.slice(0, 15000) + "\n...(truncated)" : text;

            return JSON.stringify({
                url,
                title: response.data.match(/<title>(.*?)<\/title>/i)?.[1] || "No title",
                content: truncated,
            });
        } catch (error: any) {
            return JSON.stringify({
                error: `Failed to read URL: ${url}`,
                details: error.message,
            });
        }
    },
});
