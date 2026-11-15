import assert from "node:assert/strict";
import { test } from "node:test";
import { registryItemSchema, renderSource } from "../dist/src/source.js";

const url = "https://www.ui-layouts.com/r/demo.json";

const render = (files, { dependencies = [], maxChars = 20000 } = {}) =>
  renderSource(
    { componentName: "demo", url, maxChars },
    { dependencies, files }
  );

test("a single file comes back under its path in a fence named after its extension", () => {
  const text = render([{ path: "./components/ui/demo.tsx", content: "const a = 1;" }]);

  assert.equal(
    text,
    [
      "# Source Code",
      "- **componentName**: `demo`",
      `- **url**: ${url}`,
      "- **dependencies**: (none)",
      "- **files**: 1",
      "- **maxChars**: 20000",
      "",
      "## ./components/ui/demo.tsx",
      "```tsx",
      "const a = 1;",
      "```",
    ].join("\n")
  );
});

test("every file comes back in registry order with its path", () => {
  const text = render([
    { path: "./registry/demo.tsx", content: "import { cn } from '@/lib/utils';" },
    { path: "./lib/utils.ts", content: "export const cn = () => '';" },
  ]);

  assert.match(text, /- \*\*files\*\*: 2\n/);
  assert.ok(
    text.endsWith(
      [
        "## ./registry/demo.tsx",
        "```tsx",
        "import { cn } from '@/lib/utils';",
        "```",
        "",
        "## ./lib/utils.ts",
        "```ts",
        "export const cn = () => '';",
        "```",
      ].join("\n")
    ),
    text
  );
});

test("dependencies are listed, or (none) when the item has none", () => {
  const files = [{ path: "./demo.tsx", content: "x" }];

  assert.match(
    render(files, { dependencies: ["motion", "lucide-react"] }),
    /- \*\*dependencies\*\*: `motion`, `lucide-react`\n/
  );
  assert.match(render(files), /- \*\*dependencies\*\*: \(none\)\n/);
});

test("a txt file gets a bare fence", () => {
  const text = render([{ path: "./registry/demo.txt", content: "plain" }]);

  assert.ok(text.endsWith("## ./registry/demo.txt\n```\nplain\n```"), text);
});

test("the budget cuts the file it runs out in, closes its fence, and names it", () => {
  const text = render(
    [
      { path: "./a.tsx", content: "a".repeat(10) },
      { path: "./b.tsx", content: "b".repeat(10) },
    ],
    { maxChars: 14 }
  );

  assert.ok(text.includes("## ./a.tsx\n```tsx\naaaaaaaaaa\n```"), text);
  assert.ok(text.includes("## ./b.tsx\n```tsx\nbbbb\n```\n\n"), text);
  assert.ok(
    text.endsWith(
      "⚠️ Truncated: 14 of 20 content chars returned. Cut short: `./b.tsx`. Call again with maxChars 20 or more (max 200000) to get the rest."
    ),
    text
  );
});

test("a file after the budget runs out is not rendered and is named as left out", () => {
  const text = render(
    [
      { path: "./a.tsx", content: "a".repeat(10) },
      { path: "./b.tsx", content: "b".repeat(10) },
      { path: "./c.tsx", content: "c".repeat(10) },
    ],
    { maxChars: 14 }
  );

  assert.ok(!text.includes("## ./c.tsx"), text);
  assert.match(text, /- \*\*files\*\*: 3\n/);
  assert.ok(
    text.includes(
      "14 of 30 content chars returned. Cut short: `./b.tsx`. Left out: `./c.tsx`."
    ),
    text
  );
});

test("a file that ends exactly at the budget is whole, and the next one is left out", () => {
  const text = render(
    [
      { path: "./a.tsx", content: "a".repeat(10) },
      { path: "./b.tsx", content: "b".repeat(10) },
    ],
    { maxChars: 10 }
  );

  assert.ok(!text.includes("## ./b.tsx"), text);
  assert.ok(
    text.includes("10 of 20 content chars returned. Left out: `./b.tsx`."),
    text
  );
});

test("an item larger than the maxChars maximum says the rest is out of reach", () => {
  const text = render([{ path: "./big.tsx", content: "x".repeat(200001) }], {
    maxChars: 200000,
  });

  assert.ok(
    text.endsWith(
      "Cut short: `./big.tsx`. maxChars tops out at 200000, so one call returns at most the first 200000 chars of this item."
    ),
    text.slice(-200)
  );
});

test("there is no notice when everything fits", () => {
  const text = render(
    [
      { path: "./a.tsx", content: "a".repeat(10) },
      { path: "./b.tsx", content: "b".repeat(10) },
    ],
    { maxChars: 20 }
  );

  assert.ok(text.endsWith("bbbbbbbbbb\n```"), text);
  assert.ok(!text.includes("Truncated"), text);
});

test("the schema keeps files and dependencies and defaults dependencies to none", () => {
  const files = [{ path: "./a.tsx", content: "a", type: "registry:ui" }];

  assert.deepEqual(
    registryItemSchema.parse({ name: "demo", dependencies: ["motion"], files }),
    { dependencies: ["motion"], files: [{ path: "./a.tsx", content: "a" }] }
  );
  assert.deepEqual(registryItemSchema.parse({ files }).dependencies, []);
});

test("the schema rejects a body with no files or a non-string content", () => {
  const bodies = [
    {},
    { files: [] },
    { files: [{ path: "./a.tsx" }] },
    { files: [{ path: "./a.tsx", content: 1 }] },
    null,
    "<html>",
  ];

  for (const body of bodies) {
    assert.equal(
      registryItemSchema.safeParse(body).success,
      false,
      JSON.stringify(body)
    );
  }
});
