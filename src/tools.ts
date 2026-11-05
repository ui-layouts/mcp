import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  DocsNavigationCategories,
  DocsNavigationCategory,
  findComponent,
} from "./registry.js";
import {
  buildRemoteUrl,
  fetchResource,
  type FetchFailure,
} from "./utils/api.js";
import { extractMetaFromHtml } from "./utils/html.js";

const norm = (s: string) => s.toLowerCase().trim();
const BASE_URL = "https://www.ui-layouts.com";
const DOCS_SOURCE_BASE =
  "https://raw.githubusercontent.com/ui-layouts/uilayouts/main/apps/ui-layout/content";

function clip(text: string, maxChars: number) {
  if (text.length <= maxChars) return { text, notice: "" };
  return {
    text: text.slice(0, maxChars),
    notice: `\n\n[Truncated at maxChars: returned ${maxChars} of ${text.length} chars.]`,
  };
}

function failureText(
  failure: FetchFailure,
  url: string,
  timeoutMs: number,
  notFound: string
): string {
  switch (failure.kind) {
    case "not_found":
      return `⚠️ ${notFound} (404 from ${url})`;
    case "http_error":
      return `⚠️ HTTP ${failure.status} from ${url}. Not a 404, so the input may still be valid. Retry later.`;
    case "timeout":
      return `⚠️ Timed out after ${timeoutMs}ms fetching ${url}. Retry, or raise timeoutMs.`;
    case "network":
      return `⚠️ Network error fetching ${url} (${failure.message}). The connection failed, so the input may still be valid.`;
    case "parse":
      return `⚠️ Unexpected response body from ${url} (${failure.message}).`;
  }
}

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
      const found = findComponent({ key, href });
      if ("error" in found) {
        return {
          content: [{ type: "text", text: found.error }],
          isError: true,
        };
      }
      const { item } = found;

      const url = `${DOCS_SOURCE_BASE}${item.href}.mdx`;

      const fetched = await fetchResource(url, (res) => res.text(), timeoutMs);
      if (!fetched.ok) {
        return {
          content: [
            {
              type: "text",
              text: failureText(
                fetched.failure,
                url,
                timeoutMs,
                `No docs source for \`${item.key}\` upstream. The bundled registry may be older than the site.`
              ),
            },
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
        "",
      ].join("\n");

      const docs = clip(fetched.value, maxChars);
      return {
        content: [{ type: "text", text: header + docs.text + docs.notice }],
      };
    }
  );

  server.tool(
    "get_component_meta",
    `Fetch remote HTML metadata from ${BASE_URL} by calling ${BASE_URL}/<pathPrefix>/<registry.href>.`,
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
      pathPrefix: z.string().nullable().optional().default(null),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ key, href, pathPrefix, timeoutMs }) => {
      const found = findComponent({ key, href });
      if ("error" in found) {
        return {
          content: [{ type: "text", text: found.error }],
          isError: true,
        };
      }
      const { item } = found;

      const fullUrl = buildRemoteUrl(BASE_URL, item.href, pathPrefix);
      const fetched = await fetchResource(
        fullUrl,
        async (res) => extractMetaFromHtml(await res.text(), fullUrl),
        timeoutMs
      );
      if (!fetched.ok) {
        return {
          content: [
            {
              type: "text",
              text: failureText(
                fetched.failure,
                fullUrl,
                timeoutMs,
                `No page for \`${item.key}\` at this URL.`
              ),
            },
          ],
          isError: true,
        };
      }
      const meta = fetched.value;

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
    `Fetch component source code bundle from ${BASE_URL}/r/{key}.json (or custom filename), list files and optionally return a specific file content.`,
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

      const fetched = await fetchResource(
        jsonUrl,
        (res) => res.json() as Promise<{ files?: { content?: string }[] }>,
        timeoutMs
      );
      if (!fetched.ok) {
        return {
          content: [
            {
              type: "text",
              text: failureText(
                fetched.failure,
                jsonUrl,
                timeoutMs,
                `No registry item named "${componentName}". Registry names are the \`name\` on preview tags in get_docs output, not the docs key. If this was a preview name, its source is not published.`
              ),
            },
          ],
          isError: true,
        };
      }

      const content = fetched.value?.files?.[0]?.content;
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
        "",
      ].join("\n");

      const code = clip(content, maxChars);
      const body = ["```tsx", code.text, "```"].join("\n");

      return { content: [{ type: "text", text: header + body + code.notice }] };
    }
  );
}
