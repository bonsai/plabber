import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

let lastRun: string | null = null;
let running = false;

export async function GET() {
  let error: string | null = null;
  try {
    const path = join(process.cwd(), "..", "docs", "feed.json");
    const stat = await import("node:fs").then((fs) => fs.promises.stat(path));
    lastRun = stat.mtime.toISOString();
  } catch {}
  return NextResponse.json({ running, lastRun, error });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: string };

  if (action === "status") {
    return NextResponse.json({ running, lastRun, error: null });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
