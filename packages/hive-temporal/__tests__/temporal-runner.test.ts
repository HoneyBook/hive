import path from "path";
import { bundleWorkflowCode } from "@temporalio/worker";
import type { WorkflowBundleWithSourceMap } from "@temporalio/worker";
import { createTemporalTestRunner } from "../src/createTemporalTestRunner";
import type { TemporalHandle } from "../src/createTemporalTestRunner";

// The import of createTemporalTestRunner pulls in TemporalTestKit which
// calls setupTemporalHarness() at module-import time — registers beforeAll/afterAll
// for the shared TestWorkflowEnvironment.

// Pre-bundle the test workflows once before all tests. Using withWorkflowBundle
// (pre-compiled) avoids triggering Temporal's webpack bundler inside Worker.create
// on every test, which would be prohibitively slow.
let bundle: WorkflowBundleWithSourceMap;

beforeAll(async () => {
  bundle = await bundleWorkflowCode({
    workflowsPath: path.resolve(__dirname, "fixtures/workflows.ts"),
  });
}, 120_000);

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

  // Test 8: echoWorkflow — worker started via pre-compiled bundle; simple workflow executes end-to-end
  it("creates a worker and executes a workflow via pre-compiled bundle", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowBundle(bundle);
    await runner.run();

    const result = await runner.client.workflow.execute("echoWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `echo-${runner.taskQueue}`,
      args: ["hello from hive"],
    });

    expect(result).toBe("hello from hive");
  }, 30_000);

  // Test 9: greetingWorkflow — activity registered via withActivities is called inside the workflow
  it("passes activities to the worker and calls them inside a workflow", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowBundle(bundle);
    runner.withActivities({
      greet: async (name: string) => `Hello, ${name}!`,
    });
    await runner.run();

    const result = await runner.client.workflow.execute("greetingWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `greet-${runner.taskQueue}`,
      args: ["Hive"],
    });

    expect(result).toBe("Hello, Hive!");
  }, 30_000);

  // Test 10: parent/child — childTaskQueue is allocated; parent executes on main queue,
  // calls resolveTaskQueue (auto-injected) to get the child queue, then executes the child
  // workflow on that queue, which runs on the child worker.
  it("allocates childTaskQueue, starts two workers, and executes a parent→child workflow", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowBundle(bundle);
    runner.withChildWorkflowBundle(bundle);
    await runner.run();

    expect(runner.childTaskQueue).toBeDefined();
    expect(runner.childTaskQueue!.includes("-child-")).toBe(true);
    expect(runner.taskQueue).not.toBe(runner.childTaskQueue);

    const result = await runner.client.workflow.execute("parentWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `parent-${runner.taskQueue}`,
      args: ["World"],
    });

    expect(result).toBe("Child says: Hello, World!");
  }, 30_000);
});
