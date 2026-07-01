import { MockAdapter } from "@honeybook/hive-mock-adapter-jest";
import type { IMockAdapter } from "@honeybook/hive-mock-adapter-jest";

export const Greeter = MockAdapter(
  class MockGreeter {
    greet(_name: string): string {
      return "";
    }
    reset(): void {}
  },
);
export type Greeter = InstanceType<typeof Greeter>;

// Satisfy IMockAdapter — the type is used in tests but not required for runtime behavior
void (0 as unknown as IMockAdapter);
