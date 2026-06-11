import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { loadConfig } from "./config";
import { runScriptCommand } from "./script";
import { toICal, type ICalEvent } from "./ical";
import type { PlabberConfig, PluginDefinition } from "./types";

function getPlugin(config: PlabberConfig, moduleName: string): PluginDefinition | undefined {
  return config.plugins.find((p) => p.module === moduleName);
}

function parseFeedResult(text: string): { title?: string; link?: string; entries: Record<string, unknown>[] } {
  const parsed = JSON.parse(text) as Partial<{ title: string; link: string; entries: Record<string, unknown>[] }> | null;
  if (!parsed || !Array.isArray(parsed.entries)) {
    throw new Error("script output must be JSON with entries[]");
  }
  return parsed as { title?: string; link?: string; entries: Record<string, unknown>[] };
}

function toICalEvents(rows: Record<string, unknown>[]): ICalEvent[] {
  return rows.map((row) => ({
    uid: String(row.uid || row.url || crypto.randomUUID()),
    summary: String(row.title || ""),
    description: String(row.url || ""),
    url: String(row.url || ""),
    dtstart: String(row.published || new Date().toISOString().slice(0, 10)),
  }));
}

export async function runDigestPipeline(configPath: string): Promise<{ icalFile: string; jsonFile: string; rowCount: number; icalContent: string }> {
  const cwd = dirname(resolve(configPath));
  const config = await loadConfig(configPath);

  const sourcePlugin = getPlugin(config, "CustomFeed::Script");
  const icalPlugin = getPlugin(config, "Publish::ICal");
  const jsonPlugin = getPlugin(config, "Publish::JSON");

  if (!sourcePlugin) throw new Error("Required: CustomFeed::Script");

  const feedConfig = sourcePlugin.config as { command?: string } | undefined;
  const command = feedConfig?.command;
  if (!command) throw new Error("CustomFeed::Script requires config.command");

  const raw = await runScriptCommand(command, cwd);
  const result = parseFeedResult(raw);
  const rows = result.entries;
  const icalEvents = toICalEvents(rows);

  let icalFile = "";
  let jsonFile = "";
  let icalContent = "";

  if (icalPlugin) {
    const outConfig = icalPlugin.config as { file?: string } | undefined;
    const outPath = resolve(cwd, outConfig?.file || "docs/calendar.ics");
    await mkdir(dirname(outPath), { recursive: true });
    icalContent = toICal(icalEvents);
    await Bun.write(outPath, icalContent);
    icalFile = outPath;
  }

  if (jsonPlugin) {
    const outConfig = jsonPlugin.config as { file?: string } | undefined;
    const outPath = resolve(cwd, outConfig?.file || "docs/feed.json");
    await mkdir(dirname(outPath), { recursive: true });
    await Bun.write(outPath, JSON.stringify(rows, null, 2));
    jsonFile = outPath;
  }

  return { icalFile, jsonFile, rowCount: rows.length, icalContent };
}
