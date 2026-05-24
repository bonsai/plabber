import { loadConfig } from "./config";
import type { PlabberConfig, PluginDefinition } from "./types";
import { authenticate, downloadDriveFile } from "./auth/google";
import { cleanupText } from "./text";

function timestamp(): string {
  const n = new Date();
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${n.getFullYear()}${pad(n.getMonth() + 1)}${pad(n.getDate())}-${pad(n.getHours())}${pad(n.getMinutes())}${pad(n.getSeconds())}`;
}

function getPlugin(config: PlabberConfig, moduleName: string): PluginDefinition | undefined {
  return config.plugins.find((p) => p.module === moduleName);
}

async function runSubscription(plugin: PluginDefinition): Promise<string> {
  const cfg = plugin.config as Record<string, unknown> | undefined;
  const fileId = cfg?.fileId as string;
  const credentialsPath = (cfg?.credentialsPath as string) ?? "credentials.json";
  const tokenPath = (cfg?.tokenPath as string) ?? "token.json";

  if (!fileId) throw new Error("Subscription::GoogleDrive requires config.fileId");

  const accessToken = await authenticate(credentialsPath, tokenPath);
  return await downloadDriveFile(accessToken, fileId);
}

async function runPublish(plugin: PluginDefinition, content: string, cwd: string): Promise<string> {
  const cfg = plugin.config as Record<string, unknown> | undefined;
  let fileName = (cfg?.file as string) ?? "bookmark.txt";

  fileName = fileName.replace(/\$\{timestamp\}/g, timestamp());

  const { resolve, dirname } = await import("node:path");
  const { mkdir } = await import("node:fs/promises");
  const filePath = resolve(cwd, fileName);
  await mkdir(dirname(filePath), { recursive: true });
  await Bun.write(filePath, content);
  return filePath;
}

export async function runBookmarkPipeline(configPath: string): Promise<{ outputFile: string }> {
  const { dirname, resolve } = await import("node:path");
  const cwd = dirname(resolve(configPath));
  const config = await loadConfig(configPath);

  const subPlugin = getPlugin(config, "Subscription::GoogleDrive");
  const pubPlugin = getPlugin(config, "Publish::Text");

  if (!subPlugin) throw new Error("Required plugin: Subscription::GoogleDrive");
  if (!pubPlugin) throw new Error("Required plugin: Publish::Text");

  const raw = await runSubscription(subPlugin);
  const content = cleanupText(raw);
  const outputFile = await runPublish(pubPlugin, content, cwd);

  return { outputFile };
}
