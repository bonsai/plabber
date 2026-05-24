import type { Context, Entry, Publish } from "./types";

export class StdoutPublish implements Publish {
  name = "Publish::Stdout";

  async publish(_ctx: Context, entry: Entry): Promise<void> {
    console.log(JSON.stringify(entry, null, 2));
  }
}

export class WebhookPublish implements Publish {
  name = "Publish::Webhook";

  constructor(private url: string) {}

  async publish(_ctx: Context, entry: Entry): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      throw new Error(`Webhook responded ${res.status}: ${await res.text()}`);
    }
  }
}

export class GASPublish implements Publish {
  name = "Publish::GAS";

  constructor(private url: string) {}

  async publish(_ctx: Context, entry: Entry): Promise<void> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(entry),
    });
    if (!res.ok) {
      throw new Error(`GAS responded ${res.status}: ${await res.text()}`);
    }
  }
}

export class WorkersKVPublish implements Publish {
  name = "Publish::WorkersKV";

  constructor(
    private namespace: KVNamespace,
    private prefix: string = "entry:",
  ) {}

  async publish(_ctx: Context, entry: Entry): Promise<void> {
    const guid = (entry.guid ?? entry.url ?? Date.now().toString()) as string;
    await this.namespace.put(`${this.prefix}${guid}`, JSON.stringify(entry));
  }
}
