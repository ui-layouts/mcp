import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entries, findEntry, hrefOf, unlisted } from "./registry.js";
import { search } from "./search.js";
import {
  buildRemoteUrl,
  fetchText,
  fetchRemoteMetaHTML,
  fetchJson,
} from "./utils/api.js";

const BASE_URL = "https://ui-layouts.com";
const DOCS_SOURCE_BASE =
  "https://raw.githubusercontent.com/ui-layouts/uilayouts/main/apps/ui-layout/content";

export function registerTools(server: McpServer) {
  server.tool(
    "search_components",
    "Search ui-layouts docs pages, blocks sections, and registry item names. Results are ranked, best match first. A query can have several words, and an entry that matches more of them ranks higher.",
    {
      q: z
        .string()
        .trim()
        .min(1)
        .describe(
          "One or more words matched against name, key, group, tags, and registry item names (e.g. 'accordion', 'drag and drop', 'btn-bg-shine')"
        ),
      limit: z.number().int().min(1).max(100).optional().default(20),
    },
    async ({ q, limit }) => {
      const found = search(q, entries, unlisted);
      const hits = found.hits.slice(0, limit);
      const names = (list: string[]) =>
        list.map((name) => `\`${name}\``).join(", ");

      const lines =
        hits.length === 0 && found.unlisted.length === 0
          ? ["- No matching components."]
          : hits.map(
              ({ entry: c, items }) =>
                `- **${c.name}**  \n  - key: \`${c.key}\`  \n  - group: ${
                  c.group
                }  \n  - href: \`${hrefOf(c)}\`${
                  c.tags?.length ? `  \n  - tags: ${c.tags.join(", ")}` : ""
                }${items.length ? `  \n  - matched items: ${names(items)}` : ""}`
            );
      if (found.unlisted.length) {
        lines.push(
          "",
          "## Registry items without a docs page",
          "",
          `Pass these names straight to get_source_code: ${names(
            found.unlisted
          )}`
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `# Search Results (${hits.length} of ${
              found.hits.length
            }) for "${q}"\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_docs",
    "Fetch the docs of a component as MDX markdown from the ui-layouts source repo. The header lists the entry's registry items; pass one of those names to get_source_code. A blocks entry has no docs page and returns only its items.",
    {
      key: z.string().optional().describe("Entry key (e.g. 'accordion', 'hero-section')"),
      href: z
        .string()
        .optional()
        .describe("Entry href (e.g. '/components/accordion', '/blocks/hero-section')"),
      maxChars: z.number().int().min(200).max(200000).optional().default(20000),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ key, href, maxChars, timeoutMs }) => {
      const item = findEntry(key, href);

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

      const header = [
        `# Docs`,
        `- **name**: ${item.name}`,
        `- **key**: \`${item.key}\``,
        `- **href**: \`${hrefOf(item)}\``,
        `- **items**: ${
          item.items.map((name) => `\`${name}\``).join(", ") || "(none)"
        }`,
      ];
      if (item.kind === "block") {
        return { content: [{ type: "text", text: header.join("\n") }] };
      }

      const url = `${DOCS_SOURCE_BASE}${hrefOf(item)}.mdx`;

      const mdx = await fetchText(url, timeoutMs);
      if (!mdx) {
        return {
          content: [
            { type: "text", text: `⚠️ Failed to fetch docs source from: ${url}` },
          ],
          isError: true,
        };
      }

      header.push(`- **source**: ${url}`, `- **maxChars**: ${maxChars}`, "");

      return {
        content: [
          { type: "text", text: header.join("\n") + mdx.slice(0, maxChars) },
        ],
      };
    }
  );

  server.tool(
    "get_component_meta",
    "Fetch remote HTML metadata from https://ui-layouts.com by calling https://ui-layouts.com/<pathPrefix>/<registry.href>.",
    {
      key: z
        .string()
        .optional()
        .describe("Entry key (e.g. 'sparkles-title')"),
      href: z
        .string()
        .optional()
        .describe(
          "Entry href (e.g. '/components/sparkles-title')"
        ),
      pathPrefix: z.string().nullable().optional().default(null),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ key, href, pathPrefix, timeoutMs }) => {
      const item = findEntry(key, href);

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

      const fullUrl = buildRemoteUrl(BASE_URL, hrefOf(item), pathPrefix);
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
        `- **href**: \`${hrefOf(item)}\``,
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
    "Fetch component source code bundle from https://ui-layouts.com/r/{componentName}.json (or custom filename), list files and optionally return a specific file content.",
    {
      componentName: z
        .string()
        .trim()
        .min(1)
        .describe(
          "Registry item name from the items of get_docs (e.g. 'liquid-glass-weather', 'btn-bg-shine')"
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
