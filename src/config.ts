import type { PlabberConfig } from "./types";

export async function loadConfig(path: string): Promise<PlabberConfig> {
  const text = await Bun.file(path).text();
  const parsed = Bun.YAML.parse(text) as Partial<PlabberConfig> | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`invalid config: ${path}`);
  }

  if (!Array.isArray(parsed.plugins)) {
    throw new Error("config.plugins must be an array");
  }

  return {
    global: parsed.global ?? {},
    plugins: parsed.plugins,
  };
}
