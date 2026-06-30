import { MockAdapter } from "@honeybook/hive-mock-adapter-jest";

export const Storage = MockAdapter(
  class MockStorage {
    save(_key: string, _val: string): void {}
    load(_key: string): string | null {
      return null;
    }
    reset(): void {}
  }
);
export type Storage = InstanceType<typeof Storage>;
