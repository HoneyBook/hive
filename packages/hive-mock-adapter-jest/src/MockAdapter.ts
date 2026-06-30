import { MockAdapter as CoreMockAdapter } from "@honeybook/hive-mock-adapter";

export function MockAdapter<T extends { new (...args: any[]): { reset(): void } }>(Base: T): T {
  return CoreMockAdapter(Base, { spy: jest.spyOn });
}
