import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DocsNavigationCategories, DocsNavigationCategory } from './registry.js';
import { buildRemoteUrl, fetchRemoteMetaHTML } from './utils/api.js';

const norm = (s: string) => s.toLowerCase().trim();

const server = new McpServer({
  name: "ui-layouts-mcp",
  version: "0.0.1",
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  "hello",
  "Simple Hello World tool",
  {
    name: z.string().optional().describe("Your name (optional)"),
  },
  async ({ name }) => {
    return {
      content: [
        {
          type: "text",
          text: `Hello, ${name ?? "world"}! 👋`,
        },
      ],
    };
  },
);

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
    pathPrefix: z.string().optional().default("url"),
    timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
  },
  async ({ key, href, pathPrefix, timeoutMs }) => {
    const baseUrl = "https://ui-layouts.com";

    let item: DocsNavigationCategory | undefined;
    if (key) item = DocsNavigationCategories.find((c) => c.key === key);
    if (!item && href) item = DocsNavigationCategories.find((c) => c.href === href);

    if (!item) {
      return {
        content: [{ type: "text", text: `Not found (key=${key ?? "-"}, href=${href ?? "-"})` }],
      };
    }

    const fullUrl = buildRemoteUrl(baseUrl, item.href, pathPrefix);
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ ui-layouts MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in main():", err);
  process.exit(1);
});