import type { RegistryEntry } from "./registry.js";

export interface SearchHit {
  entry: RegistryEntry;
  items: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  unlisted: string[];
}

const WEIGHT = { name: 3, tag: 2, other: 1 };
const EXACT = 1;
// Half a point under an exact match, so a prefix in a stronger field still beats an exact match in a weaker one.
const PREFIX = 0.5;
// A shorter word is a prefix of most names: "a" matched 38 of 83 entries.
const MIN_PREFIX_LENGTH = 3;

const wordsOf = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const squash = (text: string) => wordsOf(text).join("");

function match(word: string, text: string) {
  const forms = [...wordsOf(text), squash(text)];
  if (forms.includes(word)) return EXACT;
  if (word.length < MIN_PREFIX_LENGTH) return 0;
  return forms.some((form) => form.startsWith(word)) ? PREFIX : 0;
}

function score(words: string[], entry: RegistryEntry) {
  const names = [entry.key, entry.name];
  const fields: [weight: number, texts: string[]][] = [
    [WEIGHT.name, names],
    [WEIGHT.tag, entry.tags],
    [WEIGHT.other, [...entry.items, entry.group]],
  ];
  const query = words.join("");
  let total = names.some((name) => squash(name) === query) ? WEIGHT.name : 0;
  for (const word of words) {
    total += Math.max(
      ...fields.map(([weight, texts]) => {
        const best = Math.max(0, ...texts.map((text) => match(word, text)));
        return best && weight - (EXACT - best);
      })
    );
  }
  return total;
}

export function search(
  query: string,
  entries: RegistryEntry[],
  unlisted: string[]
): SearchResult {
  const words = [...new Set(wordsOf(query))];
  if (words.length === 0) return { hits: [], unlisted: [] };
  // One prefix in an item name or group is the only match under WEIGHT.other.
  // Next to other query words that found nothing, it is noise.
  const floor = words.length > 1 ? WEIGHT.other : PREFIX;

  const matched = (name: string) =>
    words.filter((word) => match(word, name)).length;
  const most = Math.max(
    0,
    ...entries.flatMap((entry) => entry.items).map(matched),
    ...unlisted.map(matched)
  );
  const matches = (name: string) => most > 0 && matched(name) === most;
  const hits = entries
    .map((entry) => ({
      entry,
      items: entry.items.filter(matches),
      score: score(words, entry),
    }))
    .filter((hit) => hit.score >= floor)
    .sort((a, b) => b.score - a.score)
    .map(({ entry, items }) => ({ entry, items }));

  return { hits, unlisted: unlisted.filter(matches) };
}
