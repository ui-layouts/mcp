import { z } from "zod";

export const MAX_CHARS = 200000;

export const registryItemSchema = z.object({
  dependencies: z.array(z.string()).default([]),
  files: z
    .array(z.object({ path: z.string(), content: z.string() }))
    .min(1),
});

export type RegistryItem = z.infer<typeof registryItemSchema>;

export interface SourceRequest {
  componentName: string;
  url: string;
  maxChars: number;
}

const code = (text: string) => `\`${text}\``;

function fenceLanguage(path: string) {
  const extension = path.match(/\.([A-Za-z0-9]+)$/)?.[1] ?? "";
  return extension === "txt" ? "" : extension;
}

export function renderSource(
  { componentName, url, maxChars }: SourceRequest,
  item: RegistryItem
): string {
  const total = item.files.reduce((sum, file) => sum + file.content.length, 0);
  const sections = [
    [
      `# Source Code`,
      `- **componentName**: ${code(componentName)}`,
      `- **url**: ${url}`,
      `- **dependencies**: ${item.dependencies.map(code).join(", ") || "(none)"}`,
      `- **files**: ${item.files.length}`,
      `- **maxChars**: ${maxChars}`,
    ].join("\n"),
  ];
  const cut: string[] = [];
  const leftOut: string[] = [];
  let remaining = maxChars;

  for (const { path, content } of item.files) {
    if (content.length > remaining) {
      if (remaining === 0) {
        leftOut.push(path);
        continue;
      }
      cut.push(path);
    }
    const shown = content.slice(0, remaining);
    remaining -= shown.length;
    sections.push(
      [`## ${path}`, "```" + fenceLanguage(path), shown, "```"].join("\n")
    );
  }

  if (cut.length || leftOut.length) {
    sections.push(
      [
        `⚠️ Truncated: ${maxChars - remaining} of ${total} content chars returned.`,
        cut.length ? `Cut short: ${cut.map(code).join(", ")}.` : "",
        leftOut.length ? `Left out: ${leftOut.map(code).join(", ")}.` : "",
        total <= MAX_CHARS
          ? `Call again with maxChars ${total} or more (max ${MAX_CHARS}) to get the rest.`
          : `maxChars tops out at ${MAX_CHARS}, so one call returns at most the first ${MAX_CHARS} chars of this item.`,
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  return sections.join("\n\n");
}
