import data from "./registry.generated.json" with { type: "json" };

export interface RegistryEntry {
  kind: "component" | "block";
  key: string;
  name: string;
  group: string;
  tags: string[];
  items: string[];
}

export const entries = data.entries as RegistryEntry[];
export const unlisted: string[] = data.unlisted;

export const hrefOf = (entry: RegistryEntry) =>
  `/${entry.kind === "block" ? "blocks" : "components"}/${entry.key}`;

export function findEntry(key?: string, href?: string) {
  return (
    (key ? entries.find((e) => e.key === key) : undefined) ??
    (href ? entries.find((e) => hrefOf(e) === href) : undefined)
  );
}
