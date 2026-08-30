import { MockAdapter as CoreMockAdapter } from "@honeybook/hive-mock-adapter";
import type { CleanupMode } from "@honeybook/hive-mock-adapter";
import { vi } from "vitest";

/**
 * `MockAdapter` with `vi.spyOn` already wired in.
 *
 * `cleanup` decides what happens between tests — see the core package for the full
 * explanation. In short: `"reset"` (default) keeps the instance and calls `reset()` on
 * it, which is what a module-level `export const adapter = new Adapter()` needs;
 * `"recreate"` drops the instance so the next `new` builds and re-spies a fresh one,
 * which is right when a kit or factory constructs the adapter per test.
 */
export function MockAdapter<T extends { new (...args: any[]): object }>(
  Base: T,
  options: { cleanup: "recreate" },
): T;
export function MockAdapter<T extends { new (...args: any[]): { reset(): void } }>(
  Base: T,
  options?: { cleanup?: "reset" },
): T;
export function MockAdapter(
  Base: { new (...args: any[]): { reset(): void } },
  options?: { cleanup?: CleanupMode },
): unknown {
  return CoreMockAdapter(Base, { spy: vi.spyOn, cleanup: options?.cleanup as "reset" | undefined });
}
