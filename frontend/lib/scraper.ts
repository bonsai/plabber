const BASE_URL = "https://prtimes.jp";

export type Entry = {
  uid: string;
  title: string;
  url: string;
  published: string;
  eventDate: string;
  summary: string;
  company: string;
};

function parseJpDate(text: string): string {
  const m = text.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }
  const m2 = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return "";
}

function extractEventDate(title: string, _desc: string): string {
  const text = title;
  const patterns = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const y = m[1].padStart(4, "0");
      const mo = m[2].padStart(2, "0");
      const d = m[3].padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
  }
  return "";
}

function extractTitle(a: string): string | null {
  const m = a.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, "").trim();
}

function extractUrl(a: string): string | null {
  const m = a.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
  if (!m) return null;
  return m[1].startsWith("http") ? m[1] : `${BASE_URL}${m[1]}`;
}

function extractCompany(article: string): string | null {
  const m = article.match(/<a[^>]+class="[^"]*name-company[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  return m ? m[1].replace(/<[^>]+>/g, "").trim() : null;
}

function extractItems(html: string): Entry[] {
  const items: Entry[] = [];
  const blocks = html.split(/<article\s/i);
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const articleEnd = block.indexOf("</article>");
    if (articleEnd === -1) continue;
    const article = block.slice(0, articleEnd);
    const title = extractTitle(article);
    const url = extractUrl(article);
    const published = parseJpDate(article) || new Date().toISOString().slice(0, 10);
    const eventDate = extractEventDate(title || "", "");
    const company = extractCompany(article);
    if (url) {
      items.push({ uid: url, title: title || "no title", url, published, eventDate, summary: "", company: company || "" });
    }
  }
  return items;
}

export async function scrapePRTimes(keywords: string[], industries: string[]): Promise<Entry[]> {
  const all: Entry[] = [];
  const seen = new Set<string>();
  for (const kw of keywords) {
    const url = `${BASE_URL}/topics/keywords/${encodeURIComponent(kw)}`;
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

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function toICal(events: Entry[]): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Plabber//Plabber Digest//JA",
    "X-WR-CALNAME:飲食イベント新着", "X-WR-TIMEZONE:Asia/Tokyo",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  ];
  for (const ev of events) {
    const calDate = ev.eventDate || ev.published;
    lines.push("BEGIN:VEVENT", `UID:${ev.uid}`, `DTSTAMP:${now}`, `SUMMARY:${esc(ev.title)}`);
    lines.push(`DTSTART;VALUE=DATE:${calDate.replace(/-/g, "")}`);
    lines.push(`DTEND;VALUE=DATE:${calDate.replace(/-/g, "")}`);
    if (ev.url) lines.push(`URL:${ev.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
