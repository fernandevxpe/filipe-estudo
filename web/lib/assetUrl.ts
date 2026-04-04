/**
 * URLs de figuras: em produção/preview na Vercel os PNG vivem em `public/data/assets` (copiados no build).
 * Em desenvolvimento local usa-se `/api/asset` para não obrigar cópia.
 */
export function getAssetSrc(ref: string): string {
  const normalized = ref.replace(/^\/+/, "");
  if (normalized.startsWith("data/assets/")) {
    const vercel = process.env.NEXT_PUBLIC_VERCEL_ENV ?? "";
    if (vercel === "production" || vercel === "preview") {
      return `/${normalized}`;
    }
  }
  return `/api/asset?path=${encodeURIComponent(ref)}`;
}
