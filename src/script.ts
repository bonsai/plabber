import { pathToFileURL } from "node:url";
import { isAbsolute, resolve } from "node:path";

function splitCommand(command: string): string[] {
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ""));
}

async function runInProcessBunScript(cmd: string[], cwd: string): Promise<string | null> {
  if (cmd.length !== 2 || cmd[0] !== "bun") {
    return null;
  }

  const scriptPath = isAbsolute(cmd[1]) ? cmd[1] : resolve(cwd, cmd[1]);
  const moduleUrl = pathToFileURL(scriptPath).toString();
  const loaded = (await import(moduleUrl)) as { default?: () => unknown; main?: () => unknown };
  const fn = loaded.default ?? loaded.main;

  if (!fn) {
    throw new Error(`script module must export default or main(): ${scriptPath}`);
  }

  const result = await fn();
  return typeof result === "string" ? result : JSON.stringify(result, null, 2);
}

export async function runScriptCommand(command: string, cwd: string): Promise<string> {
  const cmd = splitCommand(command);
  if (cmd.length === 0) {
    throw new Error("empty script command");
  }

  const inProcess = await runInProcessBunScript(cmd, cwd);
  if (inProcess !== null) {
    return `${inProcess.trim()}\n`;
  }

  const proc = Bun.spawn({
    cmd,
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`script failed (${exitCode}): ${stderr.trim() || command}`);
  }

  return stdout;
}
