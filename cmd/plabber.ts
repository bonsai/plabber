#!/usr/bin/env bun
import { runPipeline } from "../src/pipeline";

function usage(): never {
  console.error("usage: plabber run -c <config.yaml>");
  process.exit(1);
}

function parseConfigPath(args: string[]): string {
  const i = args.findIndex((a) => a === "-c" || a === "--config");
  if (i === -1 || !args[i + 1]) usage();
  return args[i + 1];
}

const [command, ...rest] = process.argv.slice(2);
if (command !== "run") usage();

const configPath = parseConfigPath(rest);
const result = await runPipeline(configPath);
console.log(`done: +${result.added} new / ${result.total} total`);
