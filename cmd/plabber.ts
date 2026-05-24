#!/usr/bin/env bun
import { runPipeline } from "../src/pipeline";

function usage(): void {
  console.error("usage: plabber run -c <config.yaml>");
  process.exit(1);
}

function parseConfigPath(args: string[]): string {
  const index = args.findIndex((arg) => arg === "-c" || arg === "--config");
  if (index === -1 || !args[index + 1]) {
    usage();
  }
  return args[index + 1];
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] !== "run") {
    usage();
  }

  const configPath = parseConfigPath(args);
  const result = await runPipeline(configPath);
  console.log(`wrote ${result.rowCount} rows to ${result.outputFile}`);
}

await main();
