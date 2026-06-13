import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { runScriptCommand } from "./script";
import { toICal, type ICalEvent } from "./ical";
import { openDb, seedFromJson, upsertEntries, getAllEntries, type EntryRow } from "./db";
import { publishGmail, type GmailConfig } from "./publish/gmail";
import { fetchInstagramEntries, type InstagramConfig } from "./sources/instagram";
import type { PlabberConfig, PluginDefinition } from "./types";

function getPlugins(config: PlabberConfig, name: string): PluginDefinition[] {
  return config.plugins.filter((p) => p.module === name);
}

function getPlugin(config: PlabberConfig, name: string): PluginDefinition | undefined {
  return config.plugins.find((p) => p.module === name);
}

function parseEntries(text: string, source: string): EntryRow[] {
  const parsed = JSON.parse(text) as Partial<{ entries: Record<string, unknown>[] }> | null;
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("script output must be JSON with entries[]");
  }
  return parsed.entries.map((e) => ({
    uid: String(e.uid ?? e.url ?? crypto.randomUUID()),
    title: String(e.title ?? ""),
    url: String(e.url ?? ""),
    published: String(e.published ?? new Date().toISOString().slice(0, 10)),
    summary: String(e.summary ?? ""),
    company: String(e.company ?? ""),
    source,
  }));
}

export async function runPipeline(configPath: string): Promise<{ total: number; added: number }> {
  const cwd = dirname(resolve(configPath));
  const config = await loadConfig(configPath);
  const db = openDb();

  // Seed SQLite from existing feed.json for cross-run deduplication
  const jsonPlugin = getPlugin(config, "Publish::JSON");
  if (jsonPlugin) {
    const jsonPath = resolve(cwd, String(jsonPlugin.config?.file ?? "docs/feed.json"));
    const f = Bun.file(jsonPath);
    if (await f.exists()) {
      const data = JSON.parse(await f.text()) as unknown[];
      if (Array.isArray(data)) seedFromJson(db, data);
    }
  }

  const before = getAllEntries(db).length;

  // Instagram flyer → VLM source
  for (const plugin of getPlugins(config, "Subscription::Instagram")) {
    const cfg = plugin.config as Partial<InstagramConfig> | undefined;
    if (!Array.isArray(cfg?.urls) || !cfg?.urls.length) continue;
    const entries = await fetchInstagramEntries(cfg as InstagramConfig);
    upsertEntries(db, entries);
  }

  for (const plugin of getPlugins(config, "CustomFeed::Script")) {
    const cmd = String((plugin.config as { command?: string } | undefined)?.command ?? "");
    if (!cmd) continue;
    const raw = await runScriptCommand(cmd, cwd);
    upsertEntries(db, parseEntries(raw, cmd));
  }

  const all = getAllEntries(db);

  for (const plugin of getPlugins(config, "Publish::JSON")) {
    const outPath = resolve(cwd, String(plugin.config?.file ?? "docs/feed.json"));
    await mkdir(dirname(outPath), { recursive: true });
    await Bun.write(outPath, JSON.stringify(all, null, 2));
  }

  for (const plugin of getPlugins(config, "Publish::ICal")) {
    const outPath = resolve(cwd, String(plugin.config?.file ?? "docs/calendar.ics"));
    await mkdir(dirname(outPath), { recursive: true });
    const events: ICalEvent[] = all.map((e) => ({
      uid: e.uid,
      summary: e.title,
      description: e.summary || e.url,
      url: e.url,
      dtstart: e.published,
    }));
    await Bun.write(outPath, toICal(events));
  }

  const result = { total: all.length, added: all.length - before };

  for (const plugin of getPlugins(config, "Publish::Gmail")) {
    const cfg = plugin.config as Partial<GmailConfig> | undefined;
    if (!cfg?.to) throw new Error("Publish::Gmail requires config.to");
    await publishGmail(cfg as GmailConfig, all, result.added);
  }

  return result;
}
