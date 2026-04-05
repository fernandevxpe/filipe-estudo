import fs from "fs";
import path from "path";
import { getRepoRoot } from "@/lib/repoRoot";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function isPngBuffer(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG);
}

/**
 * Remove referências que não resolvem para arquivo em `data/assets`, vazias, ou PNGs “faixa”
 * típicos de bug na extração do PDF (altura mínima, arquivo pequeno).
 */
export function filterImageRefsForServer(refs: string[]): string[] {
  // Na Vercel não há data/assets no bundle da função — imagens servem-se como estático /data/assets/...
  if (process.env.VERCEL) {
    return refs.filter((ref) => {
      if (!ref || ref.includes("..")) return false;
      const n = ref.replace(/^\/+/, "");
      return n.startsWith("data/assets/");
    });
  }

  const root = getRepoRoot();
  const allowRoot = path.resolve(path.join(root, "data", "assets"));
  const out: string[] = [];

  for (const ref of refs) {
    if (!ref || ref.includes("..")) continue;
    const normalized = ref.replace(/^\/+/, "");
    const full = path.resolve(path.join(root, normalized));
    if (!full.startsWith(allowRoot)) continue;
    if (!fs.existsSync(full)) continue;
    const st = fs.statSync(full);
    if (!st.isFile() || st.size === 0) continue;

    const lower = ref.toLowerCase();
    if (lower.endsWith(".png")) {
      const head = Buffer.allocUnsafe(Math.min(st.size, 24));
      const fd = fs.openSync(full, "r");
      try {
        fs.readSync(fd, head, 0, head.length, 0);
      } finally {
        fs.closeSync(fd);
      }
      if (!isPngBuffer(head)) continue;
      if (head.length >= 24) {
        const w = head.readUInt32BE(16);
        const h = head.readUInt32BE(20);
        // Lixo comum: faixa larga e baixa + PNG pequeno (stream de fonte no PDF).
        if (h > 0 && w > 0 && h <= 120 && w >= 600 && st.size < 25_000) continue;
        // Faixa vertical estreita (ex. 62×2244 em Q10 cd1 2024) — outro artefacto da extração.
        if (h > 0 && w > 0 && w <= 80 && h >= 400 && st.size < 50_000) continue;
      }
    }

    out.push(ref);
  }

  return out;
}
