import { NextResponse } from "next/server";
import { DEPLOY_MARK } from "@/lib/deployMark";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    deployMark: DEPLOY_MARK,
    vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV,
  });
}
