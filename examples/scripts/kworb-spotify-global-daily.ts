const SOURCE_URL = "https://kworb.net/spotify/country/global_daily.html";

type Row = {
  date: string;
  rank: number;
  artist: string;
  title: string;
  streams: number;
  streams7: number | null;
  total_streams: number | null;
  url: string;
};

function parseNumber(value: string): number | null {
  const normalized = value.replace(/[,+]/g, "").trim();
  if (!normalized || normalized === "-") return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function detectChartDate(html: string): string {
  const match = html.match(/Spotify Daily Chart - Global - (\d{4}\/\d{2}\/\d{2})/i);
  if (match) {
    return match[1].replace(/\//g, "-");
  }
  return new Date().toISOString().slice(0, 10);
}

function detectTable(html: string): string | null {
  const match = html.match(
    /<table[^>]+id="spotifydaily"[^>]*>([\s\S]*?)<\/table>/i,
  );
  if (match) {
    return match[1];
  }
  return null;
}

function extractRows(tableHtml: string): string[] {
  return Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (match) => match[1]);
}

function extractCells(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), (match) => match[1]);
}

function extractArtistTitle(cellHtml: string): { artist: string; title: string; url: string } | null {
  const links = Array.from(
    cellHtml.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi),
    (match) => ({
      href: match[1],
      text: stripTags(match[2]),
    }),
  );

  if (links.length < 2) {
    return null;
  }

  const trackLink = links.find((link) => /\/track\//i.test(link.href)) ?? links[links.length - 1];
  const artistLink = links[0];

  return {
    artist: artistLink.text,
    title: trackLink.text,
    url: new URL(trackLink.href, SOURCE_URL).toString(),
  };
}

function parseRow(rowHtml: string, chartDate: string): Row | null {
  const cells = extractCells(rowHtml);
  if (cells.length < 11) {
    return null;
  }

  const rank = parseNumber(stripTags(cells[0]));
  if (!rank) {
    return null;
  }

  const artistTitle = extractArtistTitle(cells[2]);
  const streams = parseNumber(stripTags(cells[6]));
  const streams7 = parseNumber(stripTags(cells[8]));
  const totalStreams = parseNumber(stripTags(cells[10]));

  if (!artistTitle || streams === null) {
    return null;
  }

  return {
    date: chartDate,
    rank,
    artist: artistTitle.artist,
    title: artistTitle.title,
    streams,
    streams7,
    total_streams: totalStreams,
    url: artistTitle.url,
  };
}

export default async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "plabber-example/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const chartDate = detectChartDate(html);
  const table = detectTable(html);

  if (!table) {
    throw new Error("kworb chart table not found");
  }

  const rows = extractRows(table)
    .map((row) => parseRow(row, chartDate))
    .filter((row): row is Row => row !== null);

  const payload = {
    title: `Spotify Daily Chart - Global - ${chartDate}`,
    link: SOURCE_URL,
    entries: rows,
  };

  return payload;
}

if (import.meta.main) {
  const payload = await main();
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}
