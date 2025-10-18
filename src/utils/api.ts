import { extractMetaFromHtml } from './html.js';

const UA = "ui-layouts-mcp/0.1 (+mcp)";

export function buildRemoteUrl(baseUrl: string, href: string, pathPrefix?: string) {
  const base = baseUrl.replace(/\/+$/, "");
  const prefix = pathPrefix ? `/${pathPrefix.replace(/^\/+|\/+$/g, "")}` : "";
  const cleanHref = href.startsWith("/") ? href : `/${href}`;
  return `${base}${prefix}${cleanHref}`;
}

export async function fetchRemoteMetaHTML(url: string, timeoutMs = 7000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const html = await res.text();
    return extractMetaFromHtml(html, url);
  } catch {
    return null;
  }
}
export async function fetchHtml(url: string, timeoutMs = 7000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}
