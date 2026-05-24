#!/usr/bin/env bun
import { runPipeline } from "../src/pipeline";
import { loadConfig } from "../src/config";
import { runPluginPipeline } from "../src/pipeline";

function usage(): void {
  console.error("usage: plabber <command> [options]");
  console.error("");
  console.error("Commands:");
  console.error("  run -c <config.yaml>    Execute pipeline once");
  console.error("  serve --port <port> -c <config.yaml>  HTTP server mode");
  process.exit(1);
}

function parseConfigPath(args: string[]): string {
  const index = args.findIndex((arg) => arg === "-c" || arg === "--config");
  if (index === -1 || !args[index + 1]) {
    usage();
  }
  return args[index + 1];
}

function parsePort(args: string[]): number {
  const index = args.findIndex((arg) => arg === "--port" || arg === "-p");
  if (index === -1) return 8080;
  return parseInt(args[index + 1], 10) || 8080;
}

async function runCommand(args: string[]): Promise<void> {
  const configPath = parseConfigPath(args);
  const result = await runPipeline(configPath);
  console.log(`wrote ${result.rowCount} rows to ${result.outputFile}`);
}

async function serveCommand(args: string[]): Promise<void> {
  const port = parsePort(args);
  const configPath = parseConfigPath(args);
  const config = await loadConfig(configPath);

  Bun.serve({
    port,
    async fetch(req: Request): Promise<Response> {
      const url = new URL(req.url);

      if (req.method === "POST" && url.pathname === "/run") {
        try {
          const result = await runPluginPipeline(config);
          return new Response(JSON.stringify(result), {
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      }

      if (url.pathname === "/health") {
        return new Response("ok", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    },
  });

  console.log(`plabber serve listening on :${port}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) usage();

  switch (args[0]) {
    case "run":
      await runCommand(args.slice(1));
      break;
    case "serve":
      await serveCommand(args.slice(1));
      break;
    default:
      usage();
  }
}

await main();
