export type Entry = Record<string, unknown>;

export type Feed = {
  title?: string;
  link?: string;
  entries: Entry[];
};

export type FeedResult = {
  title?: string;
  link?: string;
  entries: Entry[];
};

export type PluginDefinition = {
  module: string;
  config?: Record<string, unknown>;
};

export type PlabberConfig = {
  global?: {
    timezone?: string;
  };
  plugins: PluginDefinition[];
};

export type Context = Record<string, unknown>;

export interface Subscription {
  name: string;
  fetch(ctx: Context): Promise<Feed[]>;
}

export interface Filter {
  name: string;
  filter(ctx: Context, entry: Entry): Promise<Entry | null>;
}

export interface Publish {
  name: string;
  publish(ctx: Context, entry: Entry): Promise<void>;
}

export type TransformLLMConfig = {
  prompt: string;
  system?: string;
  mode?: "text" | "json_extract" | "json_object";
  jsonKey?: string;
  outputField?: string | string[];
  model?: string;
  baseUrl?: string;
  authHeader?: string;
  concurrency?: number;
};

declare global {
  interface ScheduledEvent {
    readonly type: "scheduled";
    readonly scheduledTime: number;
    readonly cron: string;
  }
}
