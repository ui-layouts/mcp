import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DocsNavigationCategories,
  DocsNavigationCategory,
} from "./registry.js";
import { fetchText, fetchRemoteMetaHTML, fetchJson } from "./utils/api.js";

const norm = (s: string) => s.toLowerCase().trim();
const BASE_URL = "https://ui-layouts.com";
const DOCS_SOURCE_BASE =
  "https://raw.githubusercontent.com/ui-layouts/uilayouts/main/apps/ui-layout/content";

export function registerTools(server: McpServer) {
  server.tool(
    "search_components",
    "Search ui-layouts components by name / key / group / tags / href.",
    {
      q: z
        .string()
        .trim()
        .min(1)
        .describe("Query for component name/key/group/tags/href"),
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
                `- **${c.name}**  \n  - key: \`${c.key}\`  \n  - group: ${
                  c.group
                }  \n  - href: \`${c.href}\`${
                  c.tags?.length ? `  \n  - tags: ${c.tags.join(", ")}` : ""
                }`
            );

      return {
        content: [
          {
            type: "text",
            text: `# Search Results (${
              results.length
            }) for "${q}"\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_docs",
    "Fetch the docs of a component as MDX markdown from the ui-layouts source repo. Example previews in the docs reference a name; fetch their code with get_source_code.",
    {
      key: z.string().optional().describe("DocsCategoryKey (e.g. 'accordion')"),
      href: z
        .string()
        .optional()
        .describe("DocsNavigationCategory href (e.g. '/components/accordion')"),
      maxChars: z.number().int().min(200).max(200000).optional().default(20000),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ key, href, maxChars, timeoutMs }) => {
      let item: DocsNavigationCategory | undefined;
      if (key) item = DocsNavigationCategories.find((c) => c.key === key);
      if (!item && href)
        item = DocsNavigationCategories.find((c) => c.href === href);

      if (!item) {
        return {
          content: [
            {
              type: "text",
              text: `Not found (key=${key ?? "-"}, href=${href ?? "-"})`,
            },
          ],
          isError: true,
        };
      }

      const url = `${DOCS_SOURCE_BASE}${item.href}.mdx`;

      const mdx = await fetchText(url, timeoutMs);
      if (!mdx) {
        return {
          content: [
            { type: "text", text: `⚠️ Failed to fetch docs source from: ${url}` },
          ],
          isError: true,
        };
      }

      const header = [
        `# Docs`,
        `- **name**: ${item.name}`,
        `- **key**: \`${item.key}\``,
        `- **href**: \`${item.href}\``,
        `- **source**: ${url}`,
        `- **maxChars**: ${maxChars}`,
        "",
      ].join("\n");

      return {
        content: [{ type: "text", text: header + mdx.slice(0, maxChars) }],
      };
    }
  );

  server.tool(
    "get_component_meta",
    "Fetch the HTML metadata (title, description, keywords, Open Graph, Twitter card) of a component's page on https://ui-layouts.com.",
    {
      key: z
        .string()
        .optional()
        .describe("DocsCategoryKey (e.g. 'sparkles-title')"),
      href: z
        .string()
        .optional()
        .describe(
          "DocsNavigationCategory href (e.g. '/components/sparkles-title')"
        ),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ key, href, timeoutMs }) => {
      let item: DocsNavigationCategory | undefined;
      if (key) item = DocsNavigationCategories.find((c) => c.key === key);
      if (!item && href)
        item = DocsNavigationCategories.find((c) => c.href === href);

      if (!item) {
        return {
          content: [
            {
              type: "text",
              text: `Not found (key=${key ?? "-"}, href=${href ?? "-"})`,
            },
          ],
          isError: true,
        };
      }

      const fullUrl = `${BASE_URL}${item.href}`;
      const meta = await fetchRemoteMetaHTML(fullUrl, timeoutMs);
      if (!meta) {
        return {
          content: [
            {
              type: "text",
              text: `⚠️ Failed to fetch metadata from: ${fullUrl}`,
            },
          ],
          isError: true,
        };
      }

      const componentNamesRaw = meta.other?.["component-names"] ?? [];
      const availableRaw = meta.other?.["available-components"] ?? [];

      const componentNames =
        typeof componentNamesRaw === "string"
          ? componentNamesRaw
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : Array.isArray(componentNamesRaw)
          ? componentNamesRaw
          : [];
      const availableComponents =
        typeof availableRaw === "string"
          ? availableRaw
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)
          : Array.isArray(availableRaw)
          ? availableRaw
          : [];

      const lines = [
        `# Remote Metadata`,
        `- **name**: ${item.name}`,
        `- **key**: \`${item.key}\``,
        `- **href**: \`${item.href}\``,
        `- **url**: ${meta.url}`,
        meta.title ? `- **title**: ${meta.title}` : "",
        meta.description ? `- **description**: ${meta.description}` : "",
        meta.image ? `- **image**: ${meta.image}` : "",
        meta.keywords?.length
          ? `- **keywords**: ${meta.keywords.join(", ")}`
          : "",
        meta.author ? `- **author**: ${meta.author}` : "",
        meta.creator ? `- **creator**: ${meta.creator}` : "",
        meta.ogTitle ? `- **og:title**: ${meta.ogTitle}` : "",
        meta.ogDescription ? `- **og:description**: ${meta.ogDescription}` : "",
        meta.ogImage ? `- **og:image**: ${meta.ogImage}` : "",
        meta.twitterTitle ? `- **twitter:title**: ${meta.twitterTitle}` : "",
        meta.twitterDescription
          ? `- **twitter:description**: ${meta.twitterDescription}`
          : "",
        meta.twitterImage ? `- **twitter:image**: ${meta.twitterImage}` : "",
        componentNames.length
          ? `- **ui-layouts:component-names**: ${componentNames.join(", ")}`
          : "",
        availableComponents.length
          ? `- **ui-layouts:available-components**: ${availableComponents.join(
              ", "
            )}`
          : "",
      ].filter(Boolean);

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  server.tool(
    "get_source_code",
    "Fetch component source code bundle from https://ui-layouts.com/r/{key}.json (or custom filename), list files and optionally return a specific file content.",
    {
      componentName: z
        .string()
        .trim()
        .min(1)
        .describe(
          "Component name (e.g. 'liquid-glass-weather',  'single-img-ripple-effect')"
        ),
      maxChars: z.number().int().min(200).max(200000).optional().default(20000),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ componentName, timeoutMs, maxChars }) => {
      const jsonUrl = `${BASE_URL}/r/${componentName}.json`;

      const json = await fetchJson<any>(jsonUrl, timeoutMs);
      if (!json) {
        return {
          content: [
            { type: "text", text: `⚠️ Failed to fetch from: ${jsonUrl}` },
          ],
          isError: true,
        };
      }

      const content = json?.files?.[0]?.content;
      if (!content) {
        return {
          content: [{ type: "text", text: `⚠️ No content found in ${jsonUrl}` }],
          isError: true,
        };
      }

      const header = [
        `# Source Code`,
        `- **componentName**: \`${componentName}\``,
        `- **url**: ${jsonUrl}`,
        `- **maxChars**: ${maxChars}`,
        "",
      ].join("\n");

      const body = ["```tsx", content.slice(0, maxChars), "```"].join("\n");

      return { content: [{ type: "text", text: header + body }] };
    }
  );
}
