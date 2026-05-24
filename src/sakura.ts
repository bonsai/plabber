type SakuraChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type SakuraGenreRequest = {
  artist: string;
  title: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
};

const genreCache = new Map<string, Promise<string>>();

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? "https://api.ai.sakura.ad.jp/v1").replace(/\/+$/, "");
}

function unwrapJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? text).trim();
}

function extractGenre(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("Sakura API returned an empty genre");
  }

  try {
    const parsed = JSON.parse(unwrapJsonBlock(trimmed)) as { genre?: unknown } | string;
    if (typeof parsed === "string") {
      return parsed.trim();
    }
    if (parsed && typeof parsed === "object" && typeof parsed.genre === "string") {
      return parsed.genre.trim();
    }
  } catch {
    // Fall through to text heuristics.
  }

  const directMatch = trimmed.match(/genre\s*[:=]\s*(.+)/i);
  if (directMatch?.[1]) {
    return directMatch[1].trim().replace(/^["'`]|["'`],?$/g, "");
  }

  return trimmed.split(/\r?\n/, 1)[0].trim().replace(/^["'`]|["'`],?$/g, "");
}

async function requestGenre(options: SakuraGenreRequest): Promise<string> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      messages: [
        {
          role: "system",
          content:
            "You classify music into a concise genre label. Return only valid JSON with the shape {\"genre\":\"...\"}. Use a short label, no explanation.",
        },
        {
          role: "user",
          content: [
            `Artist: ${options.artist}`,
            `Title: ${options.title}`,
            "Return one genre label.",
          ].join("\n"),
        },
      ],
      temperature: 0,
      max_tokens: 32,
      stream: false,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Sakura API request failed (${response.status} ${response.statusText}): ${responseText.trim()}`,
    );
  }

  const parsed = JSON.parse(responseText) as SakuraChatCompletionResponse;
  const content = parsed.choices?.[0]?.message?.content ?? "";
  const genre = extractGenre(content);

  if (!genre) {
    throw new Error("Sakura API response did not contain a genre");
  }

  return genre;
}

export async function inferSakuraGenre(options: SakuraGenreRequest): Promise<string> {
  const cacheKey = `${options.artist}\u0000${options.title}`;
  const cached = genreCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = requestGenre(options);
  genreCache.set(cacheKey, pending);
  return pending;
}
