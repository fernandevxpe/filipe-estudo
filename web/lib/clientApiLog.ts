/**
 * Ajuda a ver falhas de API em Inspecionar → Consola (e corpo da resposta em Rede).
 * Prefixo fixo: [Filipe:api]
 */

export function logApiFailure(label: string, res: Response, bodyText: string) {
  console.error("[Filipe:api]", label, {
    status: res.status,
    statusText: res.statusText,
    url: res.url,
    bodyPreview: bodyText.slice(0, 2500),
  });
}

export function parseApiJson<T>(label: string, res: Response, text: string): T | null {
  if (!res.ok) {
    logApiFailure(label, res, text);
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    console.error("[Filipe:api]", `${label} — resposta não é JSON`, e, text.slice(0, 800));
    return null;
  }
}

export async function fetchApiJson<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  label: string
): Promise<T | null> {
  try {
    const res = await fetch(input, init);
    const text = await res.text();
    return parseApiJson<T>(label, res, text);
  } catch (e) {
    console.error("[Filipe:api]", `${label} — rede/fetch`, e);
    return null;
  }
}
