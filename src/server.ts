import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pkg from "../package.json" with { type: "json" };
import { registerTools } from "./tools.js";
import { registerPrompts } from "./prompts.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "@ui-layouts/mcp",
    version: pkg.version,
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  } as any);

  registerTools(server);
  registerPrompts(server);

  return server;
}
