import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ ui-layouts MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error in main():", err);
  process.exit(1);
});