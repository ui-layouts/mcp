import assert from "node:assert/strict";
import { test } from "node:test";
import { getCatalog } from "../dist/src/catalog.js";

test("discovers a new main component using distinct commit and tree SHAs", async t => {
  const commit = "a".repeat(40);
  const tree = "b".repeat(40);
  const api = "https://api.github.com/repos/ui-layouts/uilayouts";
  const root = "apps/ui-layout";
  const responses = new Map([
    [api + "/commits/main", { sha: commit, commit: { tree: { sha: tree } } }],
    [api + "/git/trees/" + tree + "?recursive=1", {
      sha: tree, truncated: false, tree: [{ type: "blob", path: root + "/content/components/new-demo.mdx" }],
    }],
    [`https://raw.githubusercontent.com/ui-layouts/uilayouts/${commit}/${root}/registry.json`, {
      items: [
        { name: "new-demo", files: [{ path: "./components/ui/new-demo.tsx" }] },
        { name: "new-demo-basic", files: [{ path: "./registry/components/new-demo/basic.tsx" }] },
        { name: "standalone", files: [] },
      ],
    }],
  ]);
  t.mock.method(globalThis, "fetch", async url => {
    assert.ok(responses.has(url), url);
    return Response.json(responses.get(url));
  });
  const catalog = await getCatalog();
  assert.deepEqual(catalog.entries.find(entry => entry.key === "new-demo")?.items, ["new-demo", "new-demo-basic"]);
  assert.deepEqual(catalog.unlisted, ["standalone"]);
});
