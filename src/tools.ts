import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { entries, findEntry, hrefOf, unlisted } from "./registry.js";
import { search } from "./search.js";
import { MAX_CHARS, registryItemSchema, renderSource } from "./source.js";
import { fetchResource, type FetchFailure } from "./utils/api.js";
import { extractMetaFromHtml } from "./utils/html.js";

const BASE_URL = "https://www.ui-layouts.com";
const DOCS_SOURCE_BASE =
  "https://raw.githubusercontent.com/ui-layouts/uilayouts/main/apps/ui-layout/content";

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
    "Search ui-layouts docs pages, blocks sections, and registry item names. Results are ranked, best match first. A query can have several words, and an entry that matches more of them ranks higher. A query word matches a whole word or the start of one (3+ letters). There is no fuzzy or plural matching, so use the singular ('modal', not 'modals').",
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

      const lines = hits.map(
        ({ entry: c, items }) =>
          `- **${c.name}**  \n  - key: \`${c.key}\`  \n  - group: ${
            c.group
          }  \n  - href: \`${hrefOf(c)}\`${
            c.tags?.length ? `  \n  - tags: ${c.tags.join(", ")}` : ""
          }${items.length ? `  \n  - matched items: ${names(items)}` : ""}`
      );
      if (found.unlisted.length) {
        if (lines.length) lines.push("");
        lines.push(
          "## Registry items without a docs page",
          "",
          `Pass these names straight to get_source_code: ${names(found.unlisted)}`
        );
      }
      if (lines.length === 0) lines.push("- No matching components.");

      const withoutDocs = found.unlisted.length
        ? `, ${found.unlisted.length} without a docs page`
        : "";

      return {
        content: [
          {
            type: "text",
            text: `# Search Results (${hits.length} of ${
              found.hits.length
            }${withoutDocs}) for "${q}"\n\n${lines.join("\n")}`,
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
      const mdx = fetched.value;

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
    `Fetch the HTML metadata (title, description, keywords, Open Graph, Twitter card) of a component's page on ${BASE_URL}.`,
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
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ key, href, timeoutMs }) => {
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

      const fullUrl = `${BASE_URL}${hrefOf(item)}`;
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
    `Fetch the source code of a registry item from ${BASE_URL}/r/{componentName}.json. Returns every file of the item with its path, plus the npm dependencies to install. maxChars is one budget across all files; when it runs out, the response ends with a notice naming the files that were cut short or left out.`,
    {
      componentName: z
        .string()
        .trim()
        .min(1)
        .regex(
          /^[A-Za-z0-9_-]+$/,
          "componentName takes letters, digits, '-' and '_' only"
        )
        .describe(
          "Registry item name from the items of get_docs (e.g. 'liquid-glass-weather', 'btn-bg-shine')"
        ),
      maxChars: z
        .number()
        .int()
        .min(200)
        .max(MAX_CHARS)
        .optional()
        .default(20000),
      timeoutMs: z.number().int().min(1000).max(20000).optional().default(7000),
    },
    async ({ componentName, timeoutMs, maxChars }) => {
      const jsonUrl = `${BASE_URL}/r/${componentName}.json`;

      const fetched = await fetchResource(
        jsonUrl,
        (res) => res.json() as Promise<unknown>,
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
                `No registry item named "${componentName}". Registry names are the \`items\` in the get_docs header, not the docs key.`
              ),
            },
          ],
          isError: true,
        };
      }

      const item = registryItemSchema.safeParse(fetched.value);
      if (!item.success) {
        return {
          content: [
            { type: "text", text: `⚠️ No source files found in ${jsonUrl}` },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: renderSource(
              { componentName, url: jsonUrl, maxChars },
              item.data
            ),
          },
        ],
      };
    }
  );
}
