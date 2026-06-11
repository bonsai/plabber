#!/usr/bin/env bun
import { runPipeline } from "../src/pipeline";
import { runBookmarkPipeline } from "../src/bookmark-pipeline";
import { runDigestPipeline } from "../src/digest-pipeline";

function usage(): void {
  console.error("usage: plabber <command> [options]");
  console.error("  plabber run -c <config.yaml>       Run CSV/LLM pipeline");
  console.error("  plabber bookmark -c <config.yaml>  Run bookmark pipeline");
  console.error("  plabber digest -c <config.yaml>    Run PR TIMES digest (iCal+JSON)");
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
  const command = args[0];

  if (command === "run") {
    const configPath = parseConfigPath(args);
    const result = await runPipeline(configPath);
    console.log(`wrote ${result.rowCount} rows to ${result.outputFile}`);
  } else if (command === "bookmark") {
    const configPath = parseConfigPath(args);
    const result = await runBookmarkPipeline(configPath);
    console.log(`wrote bookmark to ${result.outputFile}`);
  } else if (command === "digest") {
    const configPath = parseConfigPath(args);
    const result = await runDigestPipeline(configPath);
    console.log(`wrote ${result.rowCount} events to ${result.icalFile} and ${result.jsonFile}`);
    if (result.icalContent) {
      console.log("\n--- iCal ---");
      console.log(result.icalContent);
    }
  } else {
    usage();
  }
}

await main();
