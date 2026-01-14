# @ui-layouts/mcp

[![npm version](https://img.shields.io/npm/v/%40ui-layouts%2Fmcp.svg)](https://www.npmjs.com/package/@ui-layouts/mcp)
[![node version](https://img.shields.io/node/v/%40ui-layouts%2Fmcp.svg)](https://www.npmjs.com/package/@ui-layouts/mcp)
[![MCP Badge](https://lobehub.com/badge/mcp-full/ui-layouts-mcp)](https://lobehub.com/mcp/ui-layouts-mcp)

`@ui-layouts/mcp` provides AI assistants with several valuable tools to help them **search, understand, and retrieve UI components** from [ui-layouts.com](https://ui-layouts.com).

Each tool can be used independently, but they are designed to work together as a complete "component exploration pipeline."

## 📦 Installation & MCP Setup

### Requirements

- **Node.js:** >=20.10.0
- **MCP Client:** Claude Desktop, Cursor, or compatible MCP client

### Quick Start

Run `@ui-layouts/mcp` without installing it globally using `npx`. This is the recommended way to get started:

```jsonc
{
  "mcpServers": {
    "ui-layouts-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["@ui-layouts/mcp"]
    }
  }
}
```

> 💡 **Note:** `npx` will automatically download and run the latest version of `@ui-layouts/mcp` when needed. No global installation required!

### Using with Claude Code (CLI)

```bash
claude mcp add ui-layouts-mcp --scope user -- npx -y @ui-layouts/mcp
```

This registers the MCP server under the CLI-safe name `ui-layouts-mcp` while still using the `@ui-layouts/mcp` npm package.

---

## 🛠️ Tools

### 🔍 `search_components`

Search through the **ui-layouts.com** component registry by component name, key, group, tags, or href.
It performs intelligent matching to find components that meet your criteria and returns detailed information about each match.

**When it's useful**

- To find a specific UI component by name or tag
- To explore available components by category
- To discover components with particular design or functional features

---

### 📘 `get_docs`

Fetch the **complete documentation** for a component from **ui-layouts.com**.
You can choose how much content to return, including:

- `raw_html` — the original HTML of the documentation page
- `text` — plain text extracted from HTML
- `snippet` — the main section (e.g. `<article>` or `<main>` content only)

**When it's useful**

- To read implementation guides and examples
- To view a component’s structure, props, or variants
- To extract technical explanations for AI-assisted reasoning or integration

---

### 🧩 `get_component_meta`

Fetch structured **HTML metadata** for a specific component from **ui-layouts.com**.
It includes fields such as **title**, **description**, **keywords**, **Open Graph**, **Twitter card**,
and even custom metadata like `component-names` and `available-components`.

**When it's useful**

- To understand a component’s intent or SEO context
- To generate previews or summaries automatically
- To retrieve linked `componentNames` for source code lookup

---

### 💾 `get_source_code`

Fetch the **actual TypeScript/React source code** of a component directly from
[`https://ui-layouts.com/r/{component}.json`](https://ui-layouts.com/r/accordion.json).
The tool reads the `files[].content` field from the JSON registry and returns the `.tsx` implementation.

**When it's useful**

- To review or analyze the source code of a component
- To use the component implementation as a code example
- To verify that a component matches your design or API expectations

---

## 🔗 Recommended Workflow

> 💡 **Tip:** Combine these tools for a full exploration experience:
> `search_components → get_docs → get_component_meta → get_source_code`

| Step | Description                               | Example                                                          |
| ---- | ----------------------------------------- | ---------------------------------------------------------------- |
| ①    | Find components matching a keyword or tag | `search_components { "q": "accordion" }`                         |
| ②    | Fetch their documentation (HTML/Text)     | `get_docs { "key": "accordion", "format": "snippet" }`           |
| ③    | Retrieve metadata & component links       | `get_component_meta { "key": "accordion" }`                      |
| ④    | Get TSX source code from registry         | `get_source_code { "componentName": "single-layout-accordion" }` |

---

### ⚙️ Server Info

- **MCP server name (alias):** `ui-layouts-mcp`
- **npm package:** `@ui-layouts/mcp`
- **Version:** `0.2.0`
- **Transport:** `stdio`
- **Base URL:** [https://ui-layouts.com](https://ui-layouts.com)

---

### 🧠 Example Usage in Cursor / Claude

```bash
> call tool search_components { "q": "slider" }
> call tool get_docs { "key": "align-slider" }
> call tool get_component_meta { "key": "align-slider" }
> call tool get_source_code { "componentName": "align-slider" }
```


## 👤 Author (Naymur & Jinho)

- X: [@naymur_dev](https://x.com/naymur_dev)
- LinkedIn: [in/naymur-rahman](https://www.linkedin.com/in/naymur-rahman/)
- LinkedIn: [in/jinho-yeom](https://www.linkedin.com/in/jinho-yeom/)

## Be A Sponsor

<a href="https://buymeacoffee.com/uilayouts"> <img align="left" src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" height="50" width="210" alt="naymur-uilayout" /></a>
<br/>
