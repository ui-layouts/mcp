import assert from "node:assert/strict";
import { test } from "node:test";
import { search } from "../dist/src/search.js";

const entry = (key, fields = {}) => ({
  kind: "component",
  key,
  name: key,
  group: "Group",
  tags: [],
  items: [],
  ...fields,
});

const keys = (query, entries) =>
  search(query, entries, []).hits.map((hit) => hit.entry.key);

test("a key or name equal to the query ranks first", () => {
  const entries = [
    entry("gallery-modal", { tags: ["accordion"] }),
    entry("image-accordion", { name: "Image Accordion" }),
    entry("accordion", { name: "Accordion" }),
    entry("swapy", { name: "Swapy Drag" }),
  ];

  assert.deepEqual(keys("accordion", entries), [
    "accordion",
    "image-accordion",
    "gallery-modal",
  ]);
  assert.deepEqual(keys("swapy drag", entries), ["swapy"]);
});

test("a multi-word query matches any word and ranks more matched words higher", () => {
  const entries = [
    entry("upload", { tags: ["drop"] }),
    entry("board", { tags: ["drag", "drop"] }),
    entry("sortable", { tags: ["drag"] }),
    entry("unrelated"),
  ];

  assert.deepEqual(keys("drag and drop", entries), [
    "board",
    "upload",
    "sortable",
  ]);
});

test("separators in the query and the fields do not matter", () => {
  const entries = [
    entry("datetime-picker", { tags: ["date picker"] }),
    entry("color-wheel"),
  ];

  for (const query of ["datepicker", "date picker", "date-picker"]) {
    assert.deepEqual(keys(query, entries), ["datetime-picker"], query);
  }
});

test("item names are searched and the hit reports the matched items", () => {
  const entries = [
    entry("buttons", { items: ["btn-bg-shine", "button-active"] }),
    entry("noise", { items: ["noise-effect"] }),
  ];

  const { hits } = search("btn-bg-shine", entries, []);

  assert.equal(hits.length, 1);
  assert.equal(hits[0].entry.key, "buttons");
  assert.deepEqual(hits[0].items, ["btn-bg-shine"]);
});

test("a hit that matched outside its items reports no items", () => {
  const entries = [entry("buttons", { items: ["btn-bg-shine"] })];

  assert.deepEqual(search("buttons", entries, []).hits[0].items, []);
});

test("only the names that match the most query words are reported", () => {
  const entries = [
    entry("buttons", { items: ["btn-bg-shine", "btn-arrow-right"] }),
  ];
  const result = search("btn-bg-shine", entries, ["btn-hover"]);

  assert.deepEqual(result.hits[0].items, ["btn-bg-shine"]);
  assert.deepEqual(result.unlisted, []);
  assert.deepEqual(search("btn", entries, ["btn-hover"]).unlisted, [
    "btn-hover",
  ]);
});

test("block entries are found like component entries", () => {
  const entries = [
    entry("accordion"),
    entry("hero-section", {
      kind: "block",
      name: "Hero Section",
      group: "Blocks",
      items: ["hero-share-app"],
    }),
  ];

  assert.deepEqual(keys("hero", entries), ["hero-section"]);
  assert.deepEqual(keys("share", entries), ["hero-section"]);
  assert.deepEqual(keys("blocks", entries), ["hero-section"]);
});

test("an unlisted name that matches comes back in the unlisted result", () => {
  const result = search(
    "sticky-hero-scroll",
    [entry("accordion")],
    ["sticky-hero-scroll", "tools-tab"]
  );

  assert.deepEqual(result.hits, []);
  assert.deepEqual(result.unlisted, ["sticky-hero-scroll"]);
});

test("a query with no word characters or no match returns nothing", () => {
  const entries = [entry("accordion", { tags: ["faq"], items: ["accordion"] })];

  for (const query of ["/", "  ", "zzz"]) {
    assert.deepEqual(
      search(query, entries, ["tools-tab"]),
      { hits: [], unlisted: [] },
      JSON.stringify(query)
    );
  }
});

test("a key or name match outranks a tag match, which outranks an item match", () => {
  const entries = [
    entry("gallery", { items: ["modal-slider"] }),
    entry("dialog", { tags: ["modal"] }),
    entry("media-modal"),
    entry("popup", { name: "Modal Popup" }),
  ];

  assert.deepEqual(keys("modal", entries), [
    "media-modal",
    "popup",
    "dialog",
    "gallery",
  ]);
});

test("an exact word outranks a prefix in the same field, and a stronger field still wins", () => {
  const entries = [
    entry("liquid", { tags: ["button"] }),
    entry("buttons"),
    entry("button-group"),
  ];

  assert.deepEqual(keys("button", entries), [
    "button-group",
    "buttons",
    "liquid",
  ]);
});

test("ties keep input order", () => {
  const entries = [
    entry("media-modal"),
    entry("linear-modal"),
    entry("gallery-modal"),
  ];

  assert.deepEqual(keys("modal", entries), [
    "media-modal",
    "linear-modal",
    "gallery-modal",
  ]);
});
