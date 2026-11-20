import { TestKit } from "@honeybook/hive";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import type {
  LocalTestWorkflowEnvironmentOptions,
  TimeSkippingTestWorkflowEnvironmentOptions,
} from "@temporalio/testing";
import { registerHook } from "./hooks";

let sharedEnv: TestWorkflowEnvironment | undefined;

export type TemporalEnvironmentKind = "time-skipping" | "local";

type EnvironmentSelection =
  | { kind: "time-skipping"; options?: TimeSkippingTestWorkflowEnvironmentOptions }
  | { kind: "local"; options?: LocalTestWorkflowEnvironmentOptions };

// Default: time-skipping, as before. Per test file (each file has its own module instance).
let selection: EnvironmentSelection = { kind: "time-skipping" };

// Choose the environment for this test file: "time-skipping" (default; bundled test server) or
// "local" (a real dev server via `TestWorkflowEnvironment.createLocal()`, needed for features
// the time-skipping server lacks, e.g. newer update/Nexus behaviour). Call it at the top level
// of the test file, before the tests start (the environment is created in `beforeAll`).
export function withEnvironment(
  kind: "time-skipping",
  options?: TimeSkippingTestWorkflowEnvironmentOptions,
): void;
export function withEnvironment(kind: "local", options?: LocalTestWorkflowEnvironmentOptions): void;
export function withEnvironment(
  kind: TemporalEnvironmentKind,
  options?: TimeSkippingTestWorkflowEnvironmentOptions | LocalTestWorkflowEnvironmentOptions,
): void {
  if (sharedEnv && selection.kind !== kind) {
    throw new Error(
      `[TemporalTestKit] withEnvironment("${kind}") was called after the "${selection.kind}" environment started; call it at the top level of the test file.`,
    );
  }
  selection = { kind, options } as EnvironmentSelection;
}

// Registers the shared Temporal env once per test file at module-import time.
// Hooks come from the test framework's globals (jest / vitest `globals: true`) or from
// configureTemporalTestHooks.
export function setupTemporalHarness(): void {
  registerHook(
    "beforeAll",
    async () => {
      sharedEnv =
        selection.kind === "local"
          ? await TestWorkflowEnvironment.createLocal(selection.options)
          : // No CLI resolution: createTimeSkipping uses @temporalio/testing's bundled
            // test-server binary directly.
            await TestWorkflowEnvironment.createTimeSkipping(selection.options);
    },
    120_000, // covers first-run test-server / dev-server binary download in CI
  );

  registerHook("afterAll", async () => {
    if (sharedEnv) {
      await sharedEnv.teardown();
      sharedEnv = undefined;
    }
  });
}

export function getSharedTemporalEnv(): TestWorkflowEnvironment {
  if (!sharedEnv) {
    throw new Error(
      "[TemporalTestKit] getSharedTemporalEnv called before beforeAll — is TemporalTestKit in the runner base kit list?",
    );
  }
  return sharedEnv;
}

// Register the harness ONCE per test file at module-import time.
setupTemporalHarness();

export interface TemporalTestKitResult {
  testEnv: TestWorkflowEnvironment;
}

export class TemporalTestKit extends TestKit {
  readonly result: TemporalTestKitResult = {
    // Live getter — resolves after beforeAll has run.
    get testEnv() {
      return getSharedTemporalEnv();
    },
  };

  defaultCallback = (): void => {};

  get name(): "TemporalTestKit" {
    return "TemporalTestKit";
  }
}
