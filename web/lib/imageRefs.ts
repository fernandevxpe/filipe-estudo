/** Filtros de image_refs seguros para o bundle do cliente (sem fs). */

/** Páginas completas (pôster) antes de recortes — evita “faixa” quase invisível como primeira figura. */
export function sortImageRefsForDisplay(refs: string[]): string[] {
  if (!refs.length) return refs;
  return [...refs].sort((a, b) => {
    const af = a.includes("fullpage") ? 0 : 1;
    const bf = b.includes("fullpage") ? 0 : 1;
    if (af !== bf) return af - bf;
    return a.localeCompare(b);
  });
}

/**
 * Recortes gerados por bug na pipeline (stream de fonte/vetor do PDF), não são figuras da questão.
 * `_p1_img32` / `_p2_img3` cobrem ENEM (`prova_p1_img32`) e SSA (`..._p2_img3`).
 */
const BAD_IMAGE_REF_SUFFIXES = ["_p1_img32.png", "_p2_img3.png"];

export function stripKnownBadImageRefs(refs: string[]): string[] {
  return refs.filter((r) => !BAD_IMAGE_REF_SUFFIXES.some((s) => r.endsWith(s)));
}

function isExactlyFullpageP1(ref: string): boolean {
  return /fullpage_p1\.(png|jpe?g|webp)$/i.test(ref);
}

export function dropCoverFullpageWhenRedundant(refs: string[]): string[] {
  const hasOther = refs.some((r) => r.includes("fullpage") && !isExactlyFullpageP1(r));
  if (!hasOther) return refs;
  return refs.filter((r) => !isExactlyFullpageP1(r));
}

/** Ordem e filtros aplicados no servidor e de novo no cliente (ex.: rascunho antigo no navegador). */
export function normalizeImageRefsForClient(refs: string[]): string[] {
  return dropCoverFullpageWhenRedundant(sortImageRefsForDisplay(stripKnownBadImageRefs(refs)));
}
