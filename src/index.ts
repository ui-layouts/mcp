#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DocsNavigationCategories, DocsNavigationCategory } from './registry.js';
import { buildRemoteUrl, fetchHtml, fetchRemoteMetaHTML, fetchJson } from './utils/api.js';

const norm = (s: string) => s.toLowerCase().trim();
const BASE_URL = "https://ui-layouts.com";

const server = new McpServer({
  name: "ui-layouts-mcp",
  version: "0.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "search_components",
  "Search ui-layouts components by name / key / group / tags / href.",
  {
    q: z.string().min(1).describe("Query for component name/key/group/tags/href"),
    limit: z.number().int().min(1).max(100).optional().default(20),
  },
  async ({ q, limit }) => {
    const query = norm(q);

    const results: DocsNavigationCategory[] = [];
    for (const item of DocsNavigationCategories) {
      const haystacks = [
        item.name,
        item.key,
        item.group,
        item.href,
        ...(item.tags ?? []),
      ]
        .filter(Boolean)
        .map(norm);

      if (haystacks.some((h) => h.includes(query))) {
        results.push(item);
      }
      if (results.length >= limit) break;
    }

    const lines =
      results.length === 0
        ? ["- No matching components."]
        : results.map(
            (c) =>
              `- **${c.name}**  \n  - key: \`${c.key}\`  \n  - group: ${c.group}  \n  - href: \`${c.href}\`${c.tags?.length ? `  \n  - tags: ${c.tags.join(", ")}` : ""}`,
          );

    return {
      content: [
        {
          type: "text",
          text: `# Search Results (${results.length}) for "${q}"\n\n${lines.join(
            "\n",
          )}`,
        },
      ],
    };
  },
);


server.tool(
  "get_component_meta",
  "Fetch remote HTML metadata from https://ui-layouts.com by calling https://ui-layouts.com/<pathPrefix>/<registry.href>.",
  {
    key: z.string().optional().describe("DocsCategoryKey (e.g. 'sparkles-title')"),
    href: z.string().optional().describe("DocsNavigationCategory href (e.g. '/components/sparkles-title')"),
    pathPrefix: z.string().nullable().optional().default(null),
    timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
  },
  async ({ key, href, pathPrefix, timeoutMs }) => {

    let item: DocsNavigationCategory | undefined;
    if (key) item = DocsNavigationCategories.find((c) => c.key === key);
    if (!item && href) item = DocsNavigationCategories.find((c) => c.href === href);

    if (!item) {
      return {
        content: [{ type: "text", text: `Not found (key=${key ?? "-"}, href=${href ?? "-"})` }],
      };
    }

    const fullUrl = buildRemoteUrl(BASE_URL, item.href, pathPrefix);
    const meta = await fetchRemoteMetaHTML(fullUrl, timeoutMs);
    if (!meta) {
      return {
        content: [{ type: "text", text: `⚠️ Failed to fetch metadata from: ${fullUrl}` }],
      };
    }

    const lines = [
      `# Remote Metadata`,
      `- **name**: ${item.name}`,
      `- **key**: \`${item.key}\``,
      `- **href**: \`${item.href}\``,
      `- **url**: ${meta.url}`,
      meta.title ? `- **title**: ${meta.title}` : "",
      meta.description ? `- **description**: ${meta.description}` : "",
      meta.image ? `- **image**: ${meta.image}` : "",
      meta.keywords?.length ? `- **keywords**: ${meta.keywords.join(", ")}` : "",
      meta.author ? `- **author**: ${meta.author}` : "",
      meta.creator ? `- **creator**: ${meta.creator}` : "",
      meta.ogTitle ? `- **og:title**: ${meta.ogTitle}` : "",
      meta.ogDescription ? `- **og:description**: ${meta.ogDescription}` : "",
      meta.ogImage ? `- **og:image**: ${meta.ogImage}` : "",
      meta.twitterTitle ? `- **twitter:title**: ${meta.twitterTitle}` : "",
      meta.twitterDescription ? `- **twitter:description**: ${meta.twitterDescription}` : "",
      meta.twitterImage ? `- **twitter:image**: ${meta.twitterImage}` : "",
    ].filter(Boolean);

    return { content: [{ type: "text", text: lines.join("\n") }] };
  },
);

function htmlToText(html: string): string {
  // 스크립트/스타일 제거
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "");

  // 라인 브레이크 넣어주면 가독성 ↑
  out = out.replace(/<\/(p|div|section|article|h[1-6]|li|br|main|header|footer)>/gi, "$&\n");

  // 태그 제거
  out = out.replace(/<[^>]+>/g, "");

  // 공백 정리
  out = out.replace(/\r?\n\s*\n\s*\n+/g, "\n\n").trim();
  return out;
}

function extractMainSection(html: string): string {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
  return (
    pick(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
    pick(/<main[^>]*>([\s\S]*?)<\/main>/i) ??
    pick(/<body[^>]*>([\s\S]*?)<\/body>/i) ??
    html
  );
}

server.tool(
  "get_docs",
  "Fetch docs HTML for a component from ui-layouts.com and return as raw_html, plain text, or a main-section snippet.",
  {
    key: z.string().optional().describe("DocsCategoryKey (e.g. 'accordion')"),
    href: z.string().optional().describe("DocsNavigationCategory href (e.g. '/components/accordion')"),
    pathPrefix: z.string().nullable().optional().default(null),
    format: z.enum(["raw_html", "text", "snippet"]).optional().default("text"),
    maxChars: z.number().int().min(200).max(200000).optional().default(8000),
    timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
  },
  async ({ key, href, pathPrefix, format, maxChars, timeoutMs }) => {
    let item: DocsNavigationCategory | undefined;
    if (key) item = DocsNavigationCategories.find((c) => c.key === key);
    if (!item && href) item = DocsNavigationCategories.find((c) => c.href === href);

    if (!item) {
      return { content: [{ type: "text", text: `Not found (key=${key ?? "-"}, href=${href ?? "-"})` }] };
    }

    const url = buildRemoteUrl(BASE_URL, item.href, pathPrefix);

    const html = await fetchHtml(url, timeoutMs);
    if (!html) {
      return { content: [{ type: "text", text: `⚠️ Failed to fetch docs from: ${url}` }] };
    }

    let output: string;
    if (format === "raw_html") {
      output = html.slice(0, maxChars);
    } else if (format === "snippet") {
      const section = extractMainSection(html);
      output = htmlToText(section).slice(0, maxChars);
    } else {
      output = htmlToText(html).slice(0, maxChars);
    }

    const header = [
      `# Docs`,
      `- **name**: ${item.name}`,
      `- **key**: \`${item.key}\``,
      `- **href**: \`${item.href}\``,
      `- **url**: ${url}`,
      `- **format**: ${format}`,
      `- **maxChars**: ${maxChars}`,
      "",
    ].join("\n");

    const body =
      format === "raw_html"
        ? "```html\n" + output + "\n```"
        : output;

    return {
      content: [{ type: "text", text: header + body }],
    };
  },
);

server.tool(
  "get_source_code",
  "Fetch component source code bundle from https://ui-layouts.com/r/{key}.json (or custom filename), list files and optionally return a specific file content.",
  {
    key: z.string().optional().describe("Component name (e.g. 'liquid-glass-weather',  'single-img-ripple-effect')"),
    maxChars: z.number().int().min(200).max(200000).optional().default(20000),
    timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
  },
  async ({ key, timeoutMs, maxChars }) => {
    if (!key) {
      return { content: [{ type: "text", text: `⚠️ Component key is required` }] };
    }

    const jsonUrl = `${BASE_URL}/r/${key}.json`;

    const json = await fetchJson<any>(jsonUrl, timeoutMs);
    if (!json) {
      return { content: [{ type: "text", text: `⚠️ Failed to fetch from: ${jsonUrl}` }] };
    }

    const content = json?.files?.[0]?.content;
    if (!content) {
      return { content: [{ type: "text", text: `⚠️ No content found in ${jsonUrl}` }] };
    }

    const header = [
      `# Source Code`,
      `- **key**: \`${key}\``,
      `- **url**: ${jsonUrl}`,
      `- **maxChars**: ${maxChars}`,
      "",
    ].join("\n");

    const body = ["```tsx", content.slice(0, maxChars), "```"].join("\n");

    return { content: [{ type: "text", text: header + body }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ ui-layouts MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in main():", err);
  process.exit(1);
});