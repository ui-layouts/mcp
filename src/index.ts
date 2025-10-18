import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DocsNavigationCategories, DocsNavigationCategory } from './registry.js';

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ ui-layouts MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in main():", err);
  process.exit(1);
});