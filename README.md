# @ui-layouts/mcp

## 🛠️ Tools

`@ui-layouts/mcp` provides AI assistants with several valuable tools to help them **search, understand, and retrieve UI components** from [ui-layouts.com](https://ui-layouts.com).

Each tool can be used independently, but they are designed to work together as a complete “component exploration pipeline.”

---

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

- **Server name:** `@ui-layouts/mcp`
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
