#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const SITE = "https://raw.githubusercontent.com/ui-layouts/uilayouts/main/apps/ui-layout/";
const OUT = new URL("../src/registry.generated.json", import.meta.url);
const PREVIEW_TAGS = ["ComponentCodePreview", "BoxComponentPreview", "CodeSnippets", "IframeComponentPrieview"];
const PREVIEW_TAG = new RegExp(`<(${PREVIEW_TAGS.join("|")})\\b([^>]*)>`, "g");
const LITERAL = `'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)"`;

const fetchSite = async (path) => {
  const res = await fetch(SITE + path, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${SITE}${path}`);
  return res.text();
};

const slice = (src, start, end) => {
  const from = src.indexOf(start);
  const to = src.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`marker not found: ${start}`);
  return src.slice(from + start.length, to);
};

const literals = (text) =>
  [...text.matchAll(new RegExp(LITERAL, "g"))].map((m) => (m[1] ?? m[2]).replace(/\\(.)/g, "$1"));

const constMap = (src, name) =>
  Object.fromEntries(
    [
      ...slice(src, `export const ${name} = {`, "\n} as const;").matchAll(
        new RegExp(`(?:([\\w$]+)|${LITERAL})\\s*:\\s*(?:${LITERAL})`, "g")
      ),
    ].map((m) => [m[1] ?? m[2] ?? m[3], m[4] ?? m[5]])
  );

const objects = (arrayBody) => arrayBody.split(/\n  \{\n/).slice(1);

const field = (object, name) => object.match(new RegExp(`^\\s*${name}:\\s*(\\S.*)$`, "m"))?.[1];

const normalizePath = (path) => path.replace(/^\.\.?\//, "");

const [config, constants, registryJson] = await Promise.all(
  ["configs/docs.ts", "const/docs.ts", "registry.json"].map(fetchSite)
);

const consts = Object.fromEntries(
  ["DOCS_CATEGORY_GROUP", "DOCS_CATEGORY_KEY", "COMPONENT_KEYS"].map((name) => [name, constMap(constants, name)])
);
const resolve = (expr = "") => {
  const ref = expr.match(/^(\w+)(?:\.([\w$]+)|\[\s*(['"].*))/);
  if (ref) return consts[ref[1]]?.[ref[2] ?? literals(ref[3])[0]];
  return /^['"]/.test(expr) ? literals(expr)[0] : undefined;
};

const navSource = slice(config, "export const DocsNavigationCategories: DocsNavigationCategory[] = [", "\n];");
const nav = objects(navSource).map((object) => {
  const entry = {
    key: resolve(field(object, "key")),
    name: resolve(field(object, "name"))?.trim(),
    group: resolve(field(object, "group")),
    tags: object
      .match(new RegExp(`^\\s*tags:\\s*\\[((?:\\s*(?:${LITERAL})\\s*,?)*)\\s*\\]`, "m"))
      ?.slice(1, 2)
      .flatMap(literals)
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
  for (const [name, value] of Object.entries(entry))
    if (!value) throw new Error(`nav entry has no ${name}:\n${object}`);
  const href = resolve(field(object, "href"));
  if (href !== `/components/${entry.key}`) throw new Error(`nav href ${href} is not /components/${entry.key}`);
  return entry;
});
const hrefCount = navSource.match(/\bhref:/g)?.length;
if (nav.length !== hrefCount) throw new Error(`parsed ${nav.length} nav entries but the source has ${hrefCount} href fields`);

const componentsSource = slice(config, "export const AllComponents: IAllComponents[] = [", "\n];");
const components = objects(componentsSource).map((object) => ({
  componentName: resolve(field(object, "componentName")),
  slug: resolve(field(object, "slug")),
  file: object.match(/filesrc:\s*require\(\s*['"]([^'"]+?)\?raw['"]\s*\)/)?.[1],
}));
const componentCount = componentsSource.match(/\bcomponentName:/g)?.length;
if (components.length !== componentCount)
  throw new Error(`parsed ${components.length} AllComponents entries but the source has ${componentCount} componentName fields`);

const registry = JSON.parse(registryJson).items;
const names = new Set(registry.map((item) => item.name));
const itemsByFile = new Map();
for (const item of registry) {
  const file = normalizePath(item.files[0].path);
  itemsByFile.set(file, [...(itemsByFile.get(file) ?? []), item.name]);
}
if (!components.some((c) => c.file && itemsByFile.has(normalizePath(c.file))))
  throw new Error("no AllComponents filesrc matches a registry.json file path");

const docs = [];
for (const entry of nav) docs.push(await fetchSite(`content/components/${entry.key}.mdx`));

let tagCount = 0;
const unresolved = [];
const entries = nav.map((entry, index) => {
  const items = new Set(names.has(entry.key) ? [entry.key] : []);
  for (const [, tag, attrs] of docs[index].matchAll(PREVIEW_TAG)) {
    const name = attrs.match(/(?:^|\s)name\s*=\s*(?:'([^']*)'|"([^"]*)")/)?.slice(1).find(Boolean);
    const file =
      tag === "CodeSnippets"
        ? `components/ui/${name}.tsx`
        : components.find((c) => c.componentName === name || c.slug === name)?.file;
    const found = [...(itemsByFile.get(file && normalizePath(file)) ?? []), name].filter((n) => names.has(n));
    for (const item of found) items.add(item);
    if (!found.length) unresolved.push(`${entry.key}: <${tag} name="${name}">`);
    tagCount++;
  }
  return { kind: "component", ...entry, items: [...items] };
});
if (unresolved.length === tagCount) throw new Error(`none of the ${tagCount} preview tags resolved to a registry item`);
const absentTags = PREVIEW_TAGS.filter((tag) => !docs.some((doc) => doc.includes(`<${tag}`)));
if (absentTags.length) throw new Error(`no docs page uses <${absentTags.join(">, <")}>`);

const sections = new Map();
for (const item of registry) {
  if (item.type !== "registry:block") continue;
  const section = item.files[0].path.match(/packages\/blocks\/src\/([^/]+)\//)?.[1];
  if (!section) throw new Error(`block ${item.name} has no section: ${item.files[0].path}`);
  sections.set(section, [...(sections.get(section) ?? []), item.name]);
}
for (const [section, items] of sections) {
  const name = section.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  entries.push({ kind: "block", key: section, name, group: "Blocks", tags: [], items });
}

const keys = entries.map((entry) => entry.key);
const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
if (duplicateKeys.length) throw new Error(`duplicate entry keys: ${duplicateKeys.join(", ")}`);

const listed = new Set(entries.flatMap((entry) => entry.items));
const unlisted = registry.map((item) => item.name).filter((name) => !listed.has(name));

writeFileSync(OUT, JSON.stringify({ entries, unlisted }, null, 2) + "\n");

console.error(
  [
    `${entries.length} entries (${nav.length} component, ${sections.size} block)`,
    `${listed.size} listed items, ${unlisted.length} unlisted, ${registry.length} in registry.json`,
    `${tagCount - unresolved.length} of ${tagCount} preview tags resolved, unresolved:`,
    ...unresolved.map((line) => `  ${line}`),
  ].join("\n")
);
