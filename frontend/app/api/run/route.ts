import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scrapePRTimes, toICal } from "@/lib/scraper";

export async function POST() {
  const log: string[] = [];
  const start = Date.now();
  try {
    log.push(`[${new Date().toISOString()}] starting pipeline...`);
    const keywords = (process.env.PLABBER_KEYWORDS || "試食会").split(",").map((s) => s.trim());
    const industries = (process.env.PLABBER_INDUSTRIES || "レストラン,カフェ,ホテル,食品,飲食,ビストロ,バー,居酒屋").split(",").map((s) => s.trim());
    log.push(`keywords: ${keywords.join(", ")}`);
    log.push(`industries: ${industries.join(", ")}`);
    const events = await scrapePRTimes(keywords, industries);
    log.push(`found ${events.length} events`);
    const docsDir = "/tmp/plabber";
    await mkdir(docsDir, { recursive: true });
    await writeFile(join(docsDir, "feed.json"), JSON.stringify(events, null, 2));
    await writeFile(join(docsDir, "calendar.ics"), toICal(events));
    log.push(`wrote feed.json (${events.length} events)`);
    log.push(`wrote calendar.ics (${events.length} events)`);
    log.push(`done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
    return NextResponse.json({ ok: true, events: events.length, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push(`error: ${msg}`);
    return NextResponse.json({ error: msg, log }, { status: 500 });
  }
}
