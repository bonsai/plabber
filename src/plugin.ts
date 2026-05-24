import type { Context, Entry, Filter, PlabberConfig, PluginDefinition, Publish, Subscription } from "./types";
import { DedupedFilter, RuleFilter, TruncateFilter } from "./filter";
import { GASPublish, StdoutPublish, WebhookPublish, WorkersKVPublish } from "./publish";
import { ConfigSubscription } from "./subscription";

type PluginInstance = Subscription | Filter | Publish;

export function buildPlugins(
  config: PlabberConfig,
  deps?: { kv?: KVNamespace; storage?: { has: (k: string) => boolean; add: (k: string) => void }; cwd?: string },
): { subscriptions: Subscription[]; filters: Filter[]; publishes: Publish[] } {
  const subscriptions: Subscription[] = [];
  const filters: Filter[] = [];
  const publishes: Publish[] = [];

  for (const def of config.plugins) {
    const plugin = buildPlugin(def, deps);
    if (!plugin) continue;

    if (isSubscription(plugin)) subscriptions.push(plugin);
    else if (isFilter(plugin)) filters.push(plugin);
    else if (isPublish(plugin)) publishes.push(plugin);
  }

  return { subscriptions, filters, publishes };
}

function buildPlugin(def: PluginDefinition, deps?: { kv?: KVNamespace; storage?: { has: (k: string) => boolean; add: (k: string) => void }; cwd?: string }): PluginInstance | null {
  switch (def.module) {
    case "Subscription::Config": {
      const sub = ConfigSubscription.fromDef(def);
      if (!sub) return null;
      return sub;
    }
    case "CustomFeed::Script":
      return null; // Handled by Subscription::Config
    case "Filter::Deduped":
      return new DedupedFilter(deps?.storage);
    case "Filter::Rule": {
      const rules = (def.config as { match?: unknown; reject?: unknown }[]) ?? [];
      return new RuleFilter(rules as Array<{ match?: Record<string, string>; reject?: Record<string, string> }>);
    }
    case "Filter::Truncate":
      return new TruncateFilter((def.config as { maxLength?: number })?.maxLength);
    case "Publish::Stdout":
      return new StdoutPublish();
    case "Publish::Webhook":
      return new WebhookPublish((def.config as { url: string }).url);
    case "Publish::GAS":
      return new GASPublish((def.config as { url: string }).url);
    case "Publish::WorkersKV":
      if (!deps?.kv) throw new Error("WorkersKV requires KV namespace binding");
      return new WorkersKVPublish(deps.kv, (def.config as { prefix?: string })?.prefix);
    default:
      return null;
  }
}

function isSubscription(p: PluginInstance): p is Subscription {
  return "fetch" in p;
}

function isFilter(p: PluginInstance): p is Filter {
  return "filter" in p;
}

function isPublish(p: PluginInstance): p is Publish {
  return "publish" in p;
}
