import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "https://prtimes.jp";

type Entry = {
  uid: string;
  title: string;
  url: string;
  published: string;
  summary: string;
  company: string;
};

async function scrapePRTimes(keywords: string[], industries: string[]): Promise<Entry[]> {
  const all: Entry[] = [];
  const seen = new Set<string>();

  for (const kw of keywords) {
    const url = `${BASE_URL}/main/html/rt/p/quicksearch.shtml?query=${encodeURIComponent(kw)}`;
    const res = await fetch(url, { headers: { "user-agent": "plabber/0.1" } });
    const html = await res.text();
    const items = extractItems(html);
    for (const item of items) {
      if (!seen.has(item.uid)) {
        seen.add(item.uid);
        all.push(item);
      }
    }
  }

  return all.filter(
    (item) =>
      !industries.length ||
      industries.some((ind) => item.company.includes(ind) || item.title.includes(ind)),
  );
}

function extractItems(html: string): Entry[] {
  const items: Entry[] = [];
  const articleRe = /<article[\s\S]*?<\/article>/gi;
  let m: RegExpExecArray | null;
  while ((m = articleRe.exec(html)) !== null) {
    const a = m[0];
    const title = extractMeta(a, "og:title") || extractTitle(a);
    const url = extractUrl(a);
    const desc = extractMeta(a, "og:description") || extractDescription(a);
    const company = extractCompany(a);
    const pubMatch = a.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const published = pubMatch ? `${pubMatch[1]}-${pubMatch[2]}-${pubMatch[3]}` : new Date().toISOString().slice(0, 10);
    if (url) {
      items.push({ uid: url, title: title || "no title", url, published, summary: desc || "", company: company || "" });
    }
  }
  return items;
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property="[^"]*${property}[^"]*"[^>]+content="([^"]+)"`, "i");
  return re.exec(html)?.[1] ?? null;
}

function extractTitle(a: string): string | null {
  return a.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
}

function extractUrl(a: string): string | null {
  const m = a.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
  if (!m) return null;
  return m[1].startsWith("http") ? m[1] : `${BASE_URL}${m[1]}`;
}

function extractDescription(a: string): string | null {
  return a.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() ?? null;
}

function extractCompany(a: string): string | null {
  const m = a.match(/<div[^>]*class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : null;
}

function toICal(events: Entry[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plabber//Plabber Digest//JA",
    "X-WR-CALNAME:飲食イベント新着", "X-WR-TIMEZONE:Asia/Tokyo",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  for (const ev of events) {
    lines.push("BEGIN:VEVENT", `UID:${ev.uid}`, `DTSTAMP:${now}`, `SUMMARY:${esc(ev.title)}`);
    lines.push(`DTSTART;VALUE=DATE:${ev.published.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${ev.published.replace(/-/g, "")}`);
    if (ev.url) lines.push(`URL:${ev.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

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
    const docsDir = join(process.cwd(), "..", "docs");
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
