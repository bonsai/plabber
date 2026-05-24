export type Entry = Record<string, unknown>;

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

/** General-purpose LLM text-transform plugin */
export type TransformLLMConfig = {
  /** Prompt template with ${field} interpolation from each row */
  prompt: string;
  /** System message for the LLM (optional) */
  system?: string;
  /** Output mode: "text" | "json_extract" | "json_object" */
  mode?: "text" | "json_extract" | "json_object";
  /** Which JSON key to extract (required when mode="json_extract") */
  jsonKey?: string;
  /** Output field name(s); defaults to "__transform__" */
  outputField?: string | string[];
  /** LLM model identifier */
  model?: string;
  /** API base URL (e.g. https://api.openai.com/v1/chat/completions) */
  baseUrl?: string;
  /** Header override for Authorization (defaults to Bearer SAKURA_API_KEY) */
  authHeader?: string;
  /** Concurrency limit for parallel transforms (default 5) */
  concurrency?: number;
};
