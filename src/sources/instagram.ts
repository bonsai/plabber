import type { EntryRow } from "../db";

export type InstagramConfig = {
  urls: string[];
  category: string;
  vlm?: {
    model?: string;
    prompt?: string;
  };
};

type VLMResult = {
  title?: string;
  published?: string;
  venue?: string;
  company?: string;
  summary?: string;
};

const DEFAULT_PROMPT = `このイベントフライヤー画像から情報を抽出し、以下のJSONのみを返してください:
{"title":"イベント名","published":"YYYY-MM-DD","venue":"開催場所","company":"主催者・店名","summary":"概要100字以内"}
開催日不明の場合は今日の日付を使ってください。`;

async function fetchOgImage(postUrl: string): Promise<string | null> {
  const res = await fetch(postUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      "Accept-Language": "ja,en-US;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const m =
    html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i) ??
    html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

async function toBase64(imageUrl: string): Promise<string | null> {
  const res = await fetch(imageUrl);
  if (!res.ok) return null;
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

async function callVLM(b64: string, cfg: InstagramConfig): Promise<VLMResult> {
  const apiKey = process.env.SAKURA_API_KEY?.trim();
  if (!apiKey) throw new Error("SAKURA_API_KEY required for Subscription::Instagram VLM");

  const model = cfg.vlm?.model ?? process.env.SAKURA_MODEL ?? "gpt-4o";
  const url = process.env.SAKURA_API_BASE_URL ?? "https://api.ai.sakura.ad.jp/v1/chat/completions";
  const prompt = cfg.vlm?.prompt ?? DEFAULT_PROMPT;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 512,
    }),
  });

  if (!res.ok) throw new Error(`VLM ${res.status}: ${await res.text()}`);

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as VLMResult;
  } catch {
    return {};
  }
}

export async function fetchInstagramEntries(cfg: InstagramConfig): Promise<EntryRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const results: EntryRow[] = [];

  for (const postUrl of cfg.urls) {
    try {
      const imageUrl = await fetchOgImage(postUrl);
      if (!imageUrl) {
        console.warn(`[instagram] og:image not found: ${postUrl}`);
        continue;
      }

      const b64 = await toBase64(imageUrl);
      if (!b64) {
        console.warn(`[instagram] image fetch failed: ${imageUrl}`);
        continue;
      }

      const info = await callVLM(b64, cfg);
      results.push({
        uid: postUrl,
        title: info.title ?? "(タイトル不明)",
        url: postUrl,
        published: info.published ?? today,
        summary: info.summary ?? "",
        company: info.company ?? info.venue ?? "",
        source: "instagram",
      });
    } catch (err) {
      console.warn(`[instagram] skip ${postUrl}: ${err}`);
    }
  }

  return results;
}
