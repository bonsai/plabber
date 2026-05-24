import type { Entry, Filter } from "./types";

export class DedupedFilter implements Filter {
  name = "Filter::Deduped";
  private seen: Set<string>;

  constructor(private storage?: { has: (k: string) => boolean; add: (k: string) => void }) {
    this.seen = new Set();
  }

  async filter(_ctx: Context, entry: Entry): Promise<Entry | null> {
    const guid = (entry.guid ?? entry.url ?? "") as string;
    if (!guid) return entry;

    if (this.storage) {
      return this.storage.has(guid) ? null : entry;
    }
    if (this.seen.has(guid)) return null;
    this.seen.add(guid);
    return entry;
  }
}

export class RuleFilter implements Filter {
  name = "Filter::Rule";

  constructor(private rules: Array<{ match?: Record<string, string>; reject?: Record<string, string> }>) {}

  async filter(_ctx: Context, entry: Entry): Promise<Entry | null> {
    for (const rule of this.rules) {
      if (rule.match) {
        for (const [field, pattern] of Object.entries(rule.match)) {
          const value = String(entry[field as keyof Entry] ?? "");
          if (!new RegExp(pattern, "i").test(value)) return null;
        }
      }
      if (rule.reject) {
        for (const [field, pattern] of Object.entries(rule.reject)) {
          const value = String(entry[field as keyof Entry] ?? "");
          if (new RegExp(pattern, "i").test(value)) return null;
        }
      }
    }
    return entry;
  }
}

export class TruncateFilter implements Filter {
  name = "Filter::Truncate";

  constructor(private maxLength: number = 200) {}

  async filter(_ctx: Context, entry: Entry): Promise<Entry | null> {
    if (typeof entry.body === "string" && entry.body.length > this.maxLength) {
      return { ...entry, body: entry.body.slice(0, this.maxLength) };
    }
    return entry;
  }
}
