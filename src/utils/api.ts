import pkg from "../../package.json" with { type: "json" };

const UA = `@ui-layouts/mcp/${pkg.version} (+mcp)`;

export type FetchFailure =
  | { kind: "not_found" }
  | { kind: "http_error"; status: number }
  | { kind: "timeout" }
  | { kind: "network"; message: string }
  | { kind: "parse"; message: string };

export type FetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; failure: FetchFailure };

export function buildRemoteUrl(
  baseUrl: string,
  href: string,
  pathPrefix?: string | null
) {
  const base = baseUrl.replace(/\/+$/, "");
  const prefix = pathPrefix ? `/${pathPrefix.replace(/^\/+|\/+$/g, "")}` : "";
  const cleanHref = href.startsWith("/") ? href : `/${href}`;
  return `${base}${prefix}${cleanHref}`;
}

export async function fetchResource<T>(
  url: string,
  parse: (res: Response) => Promise<T>,
  timeoutMs: number
): Promise<FetchResult<T>> {
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    const res = await fetch(url, { signal, headers: { "User-Agent": UA } });
    if (!res.ok) {
      return {
        ok: false,
        failure:
          res.status === 404
            ? { kind: "not_found" }
            : { kind: "http_error", status: res.status },
      };
    }
    return { ok: true, value: await parse(res) };
  } catch (err) {
    return { ok: false, failure: classify(err, signal) };
  }
}

function classify(err: unknown, signal: AbortSignal): FetchFailure {
  if (signal.aborted) return { kind: "timeout" };
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof SyntaxError) return { kind: "parse", message };
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause instanceof Error) {
    const code = "code" in cause ? String(cause.code) : undefined;
    return { kind: "network", message: code ?? cause.message };
  }
  return { kind: "network", message };
}
