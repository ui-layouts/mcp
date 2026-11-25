import data from "./registry.json" with { type: "json" };

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

export function findEntry(key?: string, href?: string, catalog = entries) {
  return (
    (key ? catalog.find((e) => e.key === key) : undefined) ??
    (href ? catalog.find((e) => hrefOf(e) === href) : undefined)
  );
}
