declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  stdin: {
    read(buffer: Uint8Array): Promise<number | null>;
  };
  stdout: {
    write(data: string): void;
  };
};

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
  write(path: string, data: string): Promise<number>;
  stdin: {
    read(buffer: Uint8Array): Promise<number | null>;
  };
  serve(options: {
    port: number;
    fetch: (req: Request) => Response | Promise<Response>;
  }): {
    port: number;
    stop(): void;
  };
  spawn(options: {
    cmd: string[];
    cwd?: string;
    stdout?: "pipe" | "inherit";
    stderr?: "pipe" | "inherit";
  }): {
    stdout: any;
    stderr: any;
    exited: Promise<number>;
  };
  YAML: {
    parse(text: string): unknown;
  };
};

interface ImportMeta {
  main?: boolean;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
  export function isAbsolute(path: string): boolean;
}

declare module "node:fs/promises" {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
}

declare module "node:url" {
  export function pathToFileURL(path: string): URL;
}
