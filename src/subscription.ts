import type { Context, Feed, PluginDefinition, Subscription } from "./types";
import { runScriptCommand } from "./script";

export class ConfigSubscription implements Subscription {
  name = "Subscription::Config";

  constructor(private feeds: string[]) {}

  static fromDef(def: PluginDefinition): ConfigSubscription | null {
    const feed = def.config?.feed;
    if (!Array.isArray(feed)) return null;

    const urls = feed
      .map((item) => (item && typeof item === "object" ? (item as { url?: unknown }).url : undefined))
      .filter((url): url is string => typeof url === "string");
    if (urls.length === 0) return null;

    return new ConfigSubscription(urls);
  }

  async fetch(ctx: Context): Promise<Feed[]> {
    const results: Feed[] = [];

    for (const url of this.feeds) {
      if (url.startsWith("script:")) {
        const command = url.slice("script:").length.trim();
        const cwd = (ctx.cwd as string) ?? ".";
        const text = await runScriptCommand(command, cwd);
        const parsed = JSON.parse(text) as Partial<Feed> | null;
        if (!parsed || !Array.isArray(parsed.entries)) {
          throw new Error(`script output must be JSON with entries[]`);
        }
        results.push({
          title: parsed.title,
          link: parsed.link,
          entries: parsed.entries,
        });
      } else if (url.startsWith("http:") || url.startsWith("https:")) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
        const text = await res.text();

        if (url.endsWith(".json") || text.trim().startsWith("[")) {
          const entries = JSON.parse(text) as Record<string, unknown>[];
          results.push({ title: url, link: url, entries });
        } else {
          // Treat as single-entry content
          results.push({
            title: url,
            link: url,
            entries: [{ guid: url, title: url, body: text }],
          });
        }
      } else {
        throw new Error(`unsupported feed url scheme: ${url}`);
      }
    }

    return results;
  }
}
