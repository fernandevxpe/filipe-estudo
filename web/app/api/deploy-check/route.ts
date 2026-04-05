import { NextResponse } from "next/server";
import { DEPLOY_MARK } from "@/lib/deployMark";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "1" || url.searchParams.get("verbose") === "true";

  const base = {
    ok: true,
    deployMark: DEPLOY_MARK,
    serverTime: new Date().toISOString(),
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV,
    vercelUrl: process.env.VERCEL_URL ?? null,
    vercelDeploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };

  if (!verbose) {
    return NextResponse.json(base);
  }

  return NextResponse.json({
    ...base,
    hint: "verbose=1 — dados extra só para diagnóstico; não expor publicamente em produção sensível.",
    vercelRegion: process.env.VERCEL_REGION ?? null,
    vercelProjectId: process.env.VERCEL_PROJECT_ID ?? null,
    nodeVersion: process.version,
  });
}
