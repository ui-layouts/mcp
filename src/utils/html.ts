export interface RemoteMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  keywords?: string[];
  author?: string;
  creator?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  other?: Record<string, string>;
};

export function toAbsoluteUrl(maybeUrl?: string, base?: string) {
  try {
    if (!maybeUrl) return undefined;
    return new URL(maybeUrl, base).toString();
  } catch {
    return maybeUrl;
  }
}

export function extractMetaFromHtml(html: string, url: string): RemoteMeta {
  const get = (re: RegExp) => html.match(re)?.[1]?.trim();
  
  const getAll = (re: RegExp): Array<{ name: string; content: string }> => {
    const results: Array<{ name: string; content: string }> = [];
    const matches = html.matchAll(re);
    for (const match of matches) {
      if (match[1] && match[2]) {
        results.push({ name: match[1].trim(), content: match[2].trim() });
      }
    }
    return results;
  };

  const title =
    get(/<title[^>]*>([\s\S]*?)<\/title>/i) ??
    get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i);

  const description =
    get(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) ??
    get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i);
  const keywordsRaw = get(/<meta[^>]+name=["']keywords["'][^>]+content=["']([\s\S]*?)["']/i);
  const author = get(/<meta[^>]+name=["']author["'][^>]+content=["']([\s\S]*?)["']/i);
  const creator = get(/<meta[^>]+name=["']creator["'][^>]+content=["']([\s\S]*?)["']/i);
  
  const keywords = keywordsRaw
      ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;
  
  const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["']/i);
  const ogDescription = get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i);
  const ogImageRaw = get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([\s\S]*?)["']/i);

  const twitterTitle = get(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([\s\S]*?)["']/i);
  const twitterDescription = get(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([\s\S]*?)["']/i);
  const twitterImageRaw = get(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([\s\S]*?)["']/i);

  const ogImage = toAbsoluteUrl(ogImageRaw, url);
  const twitterImage = toAbsoluteUrl(twitterImageRaw, url);

  // Extract custom meta tags (e.g., ui-layouts:component-names)
  const customMetas = getAll(/<meta[^>]*name=["']([^"']+)["'][^>]*content=["']([^"']+)["'][^>]*>/gi);
  const other: Record<string, string> = {};
  for (const { name, content } of customMetas) {
    // Only extract ui-layouts: prefixed meta tags and remove the prefix
    if (name.startsWith('ui-layouts:')) {
      const key = name.replace(/^ui-layouts:/, '');
      other[key] = content;
    }
  }

  return {
    url,
    title,
    description,
    keywords,
    author,
    creator,
    image: ogImage || twitterImage,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    other: Object.keys(other).length > 0 ? other : undefined,
  };
}


export function htmlToText(html: string): string {
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/<\/(p|div|section|article|h[1-6]|li|br|main|header|footer)>/gi, "$&\n");

  out = out.replace(/<[^>]+>/g, "");
  out = out.replace(/\r?\n\s*\n\s*\n+/g, "\n\n").trim();
  return out;
}

export function extractMainSection(html: string): string {
  const pick = (re: RegExp) => html.match(re)?.[1]?.trim();
  return (
    pick(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
    pick(/<main[^>]*>([\s\S]*?)<\/main>/i) ??
    pick(/<body[^>]*>([\s\S]*?)<\/body>/i) ??
    html
  );
}