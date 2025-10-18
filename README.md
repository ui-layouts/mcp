# ui-layouts-mcp

## 🛠️ Tools

`UILayoutsMCP` provides AI assistants with several valuable tools to help them access, understand, and query UI components from **[ui-layouts.com](https://ui-layouts.com)**.

---

### 🔍 `search_components`

Search through the **ui-layouts.com** component registry by component name, key, group, tags, or href.  
It performs intelligent matching to find components that meet your criteria and returns detailed information about each match.

**When it's useful**
- To find a specific UI component by name or tag  
- To explore available components by category  
- To discover components with particular design or functional features  

---

### 🧩 `get_component_meta`

Fetches **HTML metadata** from **ui-layouts.com** for a specific component.  
It retrieves structured metadata including **title**, **description**, **Open Graph**, **Twitter card**, and other SEO-related tags.

**When it's useful**
- When you need detailed metadata for a component  
- To understand its purpose and features before using it  
- When integrating SEO information or generating previews  

---

### 📘 `get_docs`

Fetches the **complete documentation** for a component from **ui-layouts.com**.  
You can choose between returning the content as:
- `raw_html` — the original page HTML  
- `text` — plain text extracted from HTML  
- `snippet` — only the main content section  

**When it's useful**
- To access implementation guides or usage examples  
- To read full documentation about a component’s structure and props  
- To analyze technical details for integration or learning  

---

> 💡 **Tip:**  
> These tools can be combined for a complete exploration flow:  
> `search_components → get_component_meta → get_docs`