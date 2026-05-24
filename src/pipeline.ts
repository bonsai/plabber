import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { toCsv } from "./csv";
import { inferSakuraGenre } from "./sakura";
import { runScriptCommand } from "./script";
import { buildPlugins } from "./plugin";
import { MemoryStorage } from "./storage";
import type { Context, Entry, FeedResult, PlabberConfig, PluginDefinition, TransformLLMConfig } from "./types";

type CsvPublishConfig = {
  file: string;
  header?: boolean;
  columns: string[];
};

type SakuraGenreConfig = {
  model?: string;
  baseUrl?: string;
  artistField?: string;
  titleField?: string;
  genreField?: string;
};

function getPlugin(config: PlabberConfig, moduleName: string): PluginDefinition | undefined {
  return config.plugins.find((plugin) => plugin.module === moduleName);
}

function getFeedCommands(config: PlabberConfig): string[] {
  const plugin = getPlugin(config, "Subscription::Config");
  const feed = plugin?.config?.feed;
  if (!Array.isArray(feed)) {
    throw new Error("Subscription::Config config.feed must be an array");
  }

  return feed
    .map((item) => (item && typeof item === "object" ? (item as { url?: unknown }).url : undefined))
    .filter((url): url is string => typeof url === "string")
    .map((url) => {
      if (!url.startsWith("script:")) {
        throw new Error(`unsupported feed url: ${url}`);
      }
      return url.slice("script:".length).trim();
    });
}

function parseFeedResult(text: string): FeedResult {
  const parsed = JSON.parse(text) as Partial<FeedResult> | null;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
    throw new Error("script output must be JSON with entries[]");
  }
  return {
    title: parsed.title,
    link: parsed.link,
    entries: parsed.entries,
  };
}

function getCsvConfig(config: PlabberConfig): CsvPublishConfig {
  const plugin = getPlugin(config, "Publish::CSV");
  const csvConfig = plugin?.config as Partial<CsvPublishConfig> | undefined;
  if (!csvConfig?.file || !Array.isArray(csvConfig.columns)) {
    throw new Error("Publish::CSV requires file and columns");
  }

  return {
    file: csvConfig.file,
    header: csvConfig.header ?? true,
    columns: csvConfig.columns,
  };
}

function getSakuraConfig(config: PlabberConfig): SakuraGenreConfig | null {
  const plugin = getPlugin(config, "Enrich::SakuraGenre");
  if (!plugin) {
    return null;
  }

  const enrichConfig = plugin.config as Partial<SakuraGenreConfig> | undefined;
  return {
    model: enrichConfig?.model,
    baseUrl: enrichConfig?.baseUrl,
    artistField: enrichConfig?.artistField ?? "artist",
    titleField: enrichConfig?.titleField ?? "title",
    genreField: enrichConfig?.genreField ?? "genre",
  };
}

/** Extract a string value from a row for prompt interpolation */
function getField(row: Entry, fieldName: string): string {
  const value = row[fieldName];
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Fill a prompt template with ${field} placeholders replaced by row values */
function interpolatePrompt(template: string, row: Entry): string {
  return template.replace(/\$\{(\w+)\}/g, (_match, field) => getField(row, field));
}

/** Call the LLM API and parse the response */
async function callLLM(config: TransformLLMConfig, messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
  const apiKey = config.authHeader ? undefined : process.env.SAKURA_API_KEY?.trim();
  if (!apiKey && !process.env.SAKURA_API_KEY) {
    throw new Error("SAKURA_API_KEY is required (set SAKURA_API_KEY env var)");
  }

  const url = config.baseUrl ?? process.env.SAKURA_API_BASE_URL ?? "https://api.ai.sakura.ad.jp/v1/chat/completions";
  const headers: Record<string, string> = {
    Authorization: config.authHeader ?? `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const body = JSON.stringify({
    model: config.model ?? process.env.SAKURA_MODEL ?? "gpt-4o-mini",
    messages,
    temperature: 0.3,
    max_tokens: 2048,
  });

  const res = await fetch(url, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned no content in response");
  }
  return content.trim();
}

/** Transform rows using the generic LLM Transform plugin */
async function transformRowsWithLLM(rows: Entry[], config: PlabberConfig): Promise<Entry[]> {
  const plugin = getPlugin(config, "Transform::LLM");
  if (!plugin) {
    return rows;
  }

  const transformConfig = plugin.config as Partial<TransformLLMConfig> | undefined;
  if (!transformConfig?.prompt) {
    throw new Error("Transform::LLM requires a 'prompt' template");
  }

  const mode = transformConfig.mode ?? "text";
  const outputFields = transformConfig.outputField
    ? Array.isArray(transformConfig.outputField)
      ? transformConfig.outputField
      : [transformConfig.outputField]
    : ["__transform__"];
  const concurrency = transformConfig.concurrency ?? 5;

  // Process in batches for rate limiting
  const results: Entry[] = [];
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (row, idx) => {
        const prompt = interpolatePrompt(transformConfig.prompt!, row);
        const messages: Array<{ role: "system" | "user"; content: string }> = [];
        if (transformConfig.system) {
          messages.push({ role: "system", content: transformConfig.system });
        }
        messages.push({ role: "user", content: prompt });

        const raw = await callLLM(transformConfig as TransformLLMConfig, messages);

        switch (mode) {
          case "json_extract": {
            if (!transformConfig.jsonKey) {
              throw new Error('Transform::LLM mode "json_extract" requires jsonKey config');
            }
            try {
              const obj = JSON.parse(raw);
              return { ...row, [outputFields[idx % outputFields.length]]: obj[transformConfig.jsonKey!] };
            } catch {
              return { ...row, [outputFields[idx % outputFields.length]]: raw };
            }
          }
          case "json_object": {
            try {
              const obj = JSON.parse(raw);
              const newFields: Record<string, unknown> = {};
              for (const key of Object.keys(obj)) {
                newFields[key] = obj[key];
              }
              return { ...row, ...newFields };
            } catch {
              return { ...row, [outputFields[idx % outputFields.length]]: raw };
            }
          }
          case "text":
          default:
            return { ...row, [outputFields[idx % outputFields.length]]: raw };
        }
      }),
    );
    results.push(...batchResults);
  }

  return results;
}

/** Backward-compatible: enrich rows with Sakura genre classification */
async function enrichRowsWithSakura(rows: Entry[], config: PlabberConfig): Promise<Entry[]> {
  const enrich = getSakuraConfig(config);
  if (!enrich) {
    return rows;
  }

  const apiKey = process.env.SAKURA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SAKURA_API_KEY is required for Enrich::SakuraGenre");
  }

  const model = enrich.model ?? process.env.SAKURA_MODEL ?? "gpt-4o-mini";
  const baseUrl = enrich.baseUrl ?? process.env.SAKURA_API_BASE_URL;
  const cache = new Map<string, Promise<string>>();

  return Promise.all(
    rows.map(async (row, rowIndex) => {
      const artist = readStringField(row, enrich.artistField ?? "artist", rowIndex);
      const title = readStringField(row, enrich.titleField ?? "title", rowIndex);
      const cacheKey = `${artist}\u0000${title}`;
      const genrePromise =
        cache.get(cacheKey) ??
        inferSakuraGenre({
          artist,
          title,
          model,
          apiKey,
          baseUrl,
        });

      cache.set(cacheKey, genrePromise);
      const genre = await genrePromise;
      return {
        ...row,
        [enrich.genreField ?? "genre"]: genre,
      };
    }),
  );
}

async function writeCsv(rows: Entry[], publish: CsvPublishConfig, cwd: string): Promise<string> {
  const filePath = resolve(cwd, publish.file);
  await mkdir(dirname(filePath), { recursive: true });
  const csv = toCsv(publish.columns, rows, publish.header ?? true);
  await Bun.write(filePath, csv);
  return filePath;
}

function readStringField(row: Entry, fieldName: string, rowIndex: number): string {
  const value = row[fieldName];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`row ${rowIndex + 1} is missing required field "${fieldName}"`);
  }
  return value.trim();
}

export async function runPluginPipeline(config: PlabberConfig): Promise<{ sent: number; skipped: number; dropped: number }> {
  const storage = new MemoryStorage();
  const { subscriptions, filters, publishes } = buildPlugins(config, { storage });

  const ctx: Context = {};
  let sent = 0;
  let skipped = 0;
  let dropped = 0;

  for (const sub of subscriptions) {
    const feeds = await sub.fetch(ctx);
    for (const feed of feeds) {
      for (const entry of feed.entries) {
        const guid = (entry.guid ?? entry.url ?? "") as string;

        if (guid && storage.has(guid)) {
          skipped++;
          continue;
        }

        let current: Entry | null = entry;
        for (const filter of filters) {
          try {
            current = await filter.filter(ctx, current);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[${filter.name}] error: ${message}`);
            current = null;
          }
          if (!current) {
            dropped++;
            break;
          }
        }

        if (!current) continue;

        for (const pub of publishes) {
          try {
            await pub.publish(ctx, current);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[${pub.name}] publish error: ${message}`);
          }
        }

        if (guid) storage.add(guid);
        sent++;
      }
    }
  }

  return { sent, skipped, dropped };
}

export async function runPipeline(configPath: string): Promise<{ outputFile: string; rowCount: number }> {
  const cwd = dirname(resolve(configPath));
  const config = await loadConfig(configPath);

  const commands = getFeedCommands(config);
  if (!getPlugin(config, "CustomFeed::Script")) {
    throw new Error("CustomFeed::Script plugin is required for script: feeds");
  }

  const results = await Promise.all(commands.map(async (command) => parseFeedResult(await runScriptCommand(command, cwd))));
  let rows = results.flatMap((result) => result.entries);

  // Apply generic LLM transforms first
  rows = await transformRowsWithLLM(rows, config);

  // Then apply backward-compatible Sakura genre enrichment
  rows = await enrichRowsWithSakura(rows, config);

  const outputFile = await writeCsv(rows, getCsvConfig(config), cwd);

  return {
    outputFile,
    rowCount: rows.length,
  };
}
