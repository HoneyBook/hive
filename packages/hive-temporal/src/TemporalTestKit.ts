import { TestKit } from '@honeybook/hive';
import { TestWorkflowEnvironment } from '@temporalio/testing';

let sharedEnv: TestWorkflowEnvironment | undefined;

// Registers the shared Temporal env once per test file at module-import time.
// beforeAll/afterAll are jest globals — no import.
export function setupTemporalHarness(): void {
  beforeAll(async () => {
    // No CLI resolution: createTimeSkipping uses @temporalio/testing's bundled
    // test-server binary directly.
    sharedEnv = await TestWorkflowEnvironment.createTimeSkipping();
  }, 120_000); // covers first-run test-server binary download in CI

  afterAll(async () => {
    if (sharedEnv) {
      await sharedEnv.teardown();
      sharedEnv = undefined;
    }
  });
}

export function getSharedTemporalEnv(): TestWorkflowEnvironment {
  if (!sharedEnv) {
    throw new Error(
      '[TemporalTestKit] getSharedTemporalEnv called before beforeAll — is TemporalTestKit in the runner base kit list?',
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

  get name(): 'TemporalTestKit' {
    return 'TemporalTestKit';
  }
}
