import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getRepoRoot } from "@/lib/repoRoot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOW = path.join(getRepoRoot(), "data", "assets");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const rel = url.searchParams.get("path");
  if (!rel || rel.includes("..")) {
    return new NextResponse("Parâmetro inválido", { status: 400 });
  }
  const normalized = rel.replace(/^\/+/, "");
  const full = path.join(getRepoRoot(), normalized);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(ALLOW))) {
    return new NextResponse("Proibido", { status: 403 });
  }
  if (!fs.existsSync(resolved)) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  const buf = fs.readFileSync(resolved);
  const lower = resolved.toLowerCase();
  const type = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".jpg") || lower.endsWith(".jpeg")
      ? "image/jpeg"
      : lower.endsWith(".webp")
        ? "image/webp"
        : lower.endsWith(".gif")
          ? "image/gif"
          : "application/octet-stream";
  return new NextResponse(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
