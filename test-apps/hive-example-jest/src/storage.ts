export class Storage {
  private store: Map<string, string> = new Map();

  save(key: string, val: string): void {
    this.store.set(key, val);
  }

  load(key: string): string | null {
    return this.store.get(key) ?? null;
  }
}
