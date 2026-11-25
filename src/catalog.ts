import { z } from "zod";
import { entries, unlisted, type RegistryEntry } from "./registry.js";

const repository = "ui-layouts/uilayouts";
const root = "apps/ui-layout";
const docs = root + "/content/components/";
const treeSchema = z.object({
  sha: z.string().regex(/^[a-f0-9]{40}$/),
  truncated: z.literal(false),
  tree: z.array(z.object({ path: z.string(), type: z.string() })),
});
const registrySchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    files: z.array(z.object({ path: z.string() })),
  })),
});

async function json(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Catalog request returned ${response.status}`);
  return response.json();
}

async function fromMain() {
  const tree = treeSchema.parse(await json(
    `https://api.github.com/repos/${repository}/git/trees/main?recursive=1`
  ));
  const registry = registrySchema.parse(await json(
    `https://raw.githubusercontent.com/${repository}/${tree.sha}/${root}/registry.json`
  ));
  const pages = tree.tree.filter(file => file.type === "blob" && file.path.startsWith(docs))
    .map(file => file.path.slice(docs.length))
    .filter(path => /^[\w-]+\.mdx$/.test(path))
    .map(path => path.slice(0, -4));
  if (!pages.length || !registry.items.length) throw new Error("Empty site catalog");

  const names = new Set(registry.items.map(item => item.name));
  const live = entries.filter(entry => entry.kind === "block" || pages.includes(entry.key))
    .map(entry => ({ ...entry, items: entry.items.filter(name => names.has(name)) }));
  const components = new Map(live.filter(entry => entry.kind === "component").map(entry => [entry.key, entry]));
  for (const key of pages) {
    if (components.has(key)) continue;
    const entry: RegistryEntry = { kind: "component", key, name: key.replaceAll("-", " "), group: "Components", tags: [], items: [] };
    components.set(key, entry);
    live.push(entry);
  }
  const assigned = new Set(live.flatMap(entry => entry.items));
  for (const item of registry.items) {
    if (assigned.has(item.name)) continue;
    for (const file of item.files) {
      const key = file.path.match(/^(?:\.\/)?registry\/components\/([^/]+)\//)?.[1];
      const entry = key && components.get(key);
      if (entry) {
        entry.items.push(item.name);
        assigned.add(item.name);
        break;
      }
    }
  }
  return { entries: live, unlisted: [...names].filter(name => !assigned.has(name)) };
}

let catalog = { entries, unlisted };
let nextRefresh = 0;
let pending: Promise<typeof catalog> | undefined;

export function getCatalog() {
  if (Date.now() < nextRefresh) return Promise.resolve(catalog);
  pending ??= fromMain().then(updated => {
    catalog = updated;
    nextRefresh = Date.now() + 300_000;
  }).catch(error => {
    console.error("Using cached UI Layouts catalog:", error.message);
    nextRefresh = Date.now() + 30_000;
  }).finally(() => { pending = undefined; }).then(() => catalog);
  return pending;
}
