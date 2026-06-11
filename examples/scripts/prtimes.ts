const BASE_URL = "https://prtimes.jp";

type PRTimesItem = {
  uid: string;
  title: string;
  url: string;
  published: string;
  summary: string;
  company: string;
};

type FeedResult = {
  title: string;
  link: string;
  entries: PRTimesItem[];
};

export default async function main(): Promise<FeedResult> {
  const keywords = ["試食会"];
  const industries = ["レストラン", "カフェ", "ホテル", "食品", "飲食", "ビストロ", "バー", "居酒屋"];

  const all: PRTimesItem[] = [];
  const seen = new Set<string>();

  for (const kw of keywords) {
    const url = `${BASE_URL}/main/html/rt/p/quicksearch.shtml?query=${encodeURIComponent(kw)}`;
    const html = await fetch(url, {
      headers: { "user-agent": "plabber/0.1" },
    }).then((r) => r.text());

    const items = extractItems(html, kw);
    for (const item of items) {
      if (!seen.has(item.uid)) {
        seen.add(item.uid);
        all.push(item);
      }
    }
  }

  const filtered = all.filter((item) =>
    industries.some((ind) => item.company.includes(ind) || item.title.includes(ind)),
  );

  return {
    title: "PR TIMES 試食会",
    link: `${BASE_URL}/`,
    entries: filtered,
  };
}

function extractItems(html: string, keyword: string): PRTimesItem[] {
  const items: PRTimesItem[] = [];
  const articleRegex = /<article[\s\S]*?<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null) {
    const article = match[0];
    const title = extractMeta(article, "og:title") || extractTitle(article);
    const url = extractUrl(article);
    const desc = extractMeta(article, "og:description") || extractDescription(article);
    const company = extractCompany(article);
    const pubMatch = article.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    const published = pubMatch ? `${pubMatch[1]}-${pubMatch[2]}-${pubMatch[3]}` : new Date().toISOString().slice(0, 10);

    if (url) {
      items.push({
        uid: url,
        title: title || "no title",
        url,
        published,
        summary: desc || "",
        company: company || "",
      });
    }
  }

  return items;
}

function extractMeta(html: string, property: string): string | null {
  const re = new RegExp(`<meta[^>]+property="[^"]*${property}[^"]*"[^>]+content="([^"]+)"`, "i");
  const m = re.exec(html);
  return m ? m[1] : null;
}

function extractTitle(article: string): string | null {
  const m = article.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  return m ? stripTags(m[1]) : null;
}

function extractUrl(article: string): string | null {
  const m = article.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
  if (!m) return null;
  const url = m[1];
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}

function extractDescription(article: string): string | null {
  const m = article.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return m ? stripTags(m[1]) : null;
}

function extractCompany(article: string): string | null {
  const m = article.match(/<div[^>]*class="[^"]*company[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return m ? stripTags(m[1]) : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

if (import.meta.main) {
  const result = await main();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
