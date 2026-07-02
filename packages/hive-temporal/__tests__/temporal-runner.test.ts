import { createTemporalTestRunner } from "../src/createTemporalTestRunner.test-runner";
import type { TemporalHandle } from "../src/createTemporalTestRunner.test-runner";

// The import of createTemporalTestRunner pulls in TemporalTestKit which
// calls setupTemporalHarness() at module-import time — registers beforeAll/afterAll
// for the shared TestWorkflowEnvironment.

// Real workflow-bundle execution tests (withWorkflowBundle/withWorkflowsPath +
// an actual worker running a compiled workflow) live in hive-temporal-example's
// vitest suite instead of here — running them under this package's Jest suite
// hangs (see the removal of __tests__/fixtures/workflows.ts).

describe("createTemporalTestRunner", () => {
  // Test 1: testEnv and client are live on the handle
  it("exposes testEnv and client on the handle", async () => {
    const runner = createTemporalTestRunner([]);
    await runner.run();
    expect(runner.testEnv).toBeDefined();
    expect(typeof runner.client.workflow).toBe("object");
  });

  // Test 2: default task queue prefix; no childTaskQueue when child not configured
  it("uses default hive-test prefix for taskQueue and no childTaskQueue", async () => {
    const runner = createTemporalTestRunner([]);
    await runner.run();
    expect(runner.taskQueue.startsWith("hive-test-")).toBe(true);
    expect(runner.childTaskQueue).toBeUndefined();
  });

  // Test 3: withTaskQueuePrefix override
  it("respects withTaskQueuePrefix override", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withTaskQueuePrefix("custom");
    await runner.run();
    expect(runner.taskQueue.startsWith("custom-")).toBe(true);
  });

  // Test 4: executeActivity runs an activity in a MockActivityEnvironment
  it("executeActivity runs an activity", async () => {
    const runner = createTemporalTestRunner([]);
    await runner.run();
    const add = async (input: { a: number; b: number }) => input.a + input.b;
    const out = await runner.executeActivity(add, { a: 2, b: 3 });
    expect(out).toBe(5);
  });

  // Test 5: onReset fires before each test
  describe("onReset callback", () => {
    let resetCount = 0;
    const resetRunner = createTemporalTestRunner([], undefined, {
      onReset: () => {
        resetCount++;
      },
    });

    it("onReset has fired at least once before this test", async () => {
      await resetRunner.run();
      expect(resetCount).toBeGreaterThanOrEqual(1);
    });

    it("onReset fires again before this second test (count increased)", async () => {
      await resetRunner.run();
      expect(resetCount).toBeGreaterThanOrEqual(2);
    });
  });

  // Test 6: injectClients is invoked with the handle
  it("calls injectClients with the handle after workers start", async () => {
    const seen: TemporalHandle[] = [];
    const runner = createTemporalTestRunner([], undefined, {
      injectClients: (h) => {
        seen.push(h);
      },
    });
    await runner.run();
    expect(seen[0].testEnv).toBe(runner.testEnv);
  });

  // Test 7: void extra method chains via framework wrapping
  it("void extra method chains (framework wraps undefined return as `this`)", async () => {
    const runner = createTemporalTestRunner([], {
      withCustomLabel(): void {
        // void: framework wraps `return undefined` as `return this` automatically
      },
    });
    runner.withCustomLabel().withTaskQueuePrefix("chained");
    expect(runner.result).toBeDefined();
  });
});
