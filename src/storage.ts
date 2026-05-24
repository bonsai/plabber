export class MemoryStorage {
  private store = new Set<string>();

  has(key: string): boolean {
    return this.store.has(key);
  }

  add(key: string): void {
    this.store.add(key);
  }
}

export class KVStorage {
  constructor(private namespace: KVNamespace, private prefix: string = "seen:") {}

  async has(key: string): Promise<boolean> {
    const val = await this.namespace.get(`${this.prefix}${key}`);
    return val !== null;
  }

  async add(key: string): Promise<void> {
    await this.namespace.put(`${this.prefix}${key}`, "1", { expirationTtl: 86400 * 30 });
  }
}
