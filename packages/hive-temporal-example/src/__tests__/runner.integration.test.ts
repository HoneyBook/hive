import { fileURLToPath } from "url";
import { describe, it, expect, beforeAll } from "vitest";
import { bundleWorkflowCode } from "@temporalio/worker";
import type { WorkflowBundleWithSourceMap } from "@temporalio/worker";
import { createTemporalTestRunner } from "@honeybook/hive-temporal";
import * as activities from "../activities.js";

// Pre-compiled bundle — used by withWorkflowBundle / withChildWorkflowBundle tests.
// bundleWorkflowCode runs once; subsequent tests reuse the same compiled artifact.
let bundle: WorkflowBundleWithSourceMap;
beforeAll(async () => {
  bundle = await bundleWorkflowCode({
    workflowsPath: fileURLToPath(new URL("../testing/workflows.test-bundle.ts", import.meta.url)),
  });
}, 60_000);

// Temporal's webpack bundles this TypeScript source file at Worker.create time.
const workflowsPath = fileURLToPath(
  new URL("../testing/workflows.test-bundle.ts", import.meta.url),
);

describe("createTemporalTestRunner — integration", () => {
  it("exposes testEnv and client on the handle (no worker)", async () => {
    const runner = createTemporalTestRunner([]);
    await runner.run();
    expect(runner.testEnv).toBeDefined();
    expect(typeof runner.client.workflow).toBe("object");
    expect(runner.childTaskQueue).toBeUndefined();
  });

  it("executes echoWorkflow via a real worker", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    await runner.run();

    const result = await runner.client.workflow.execute("echoWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `echo-${runner.taskQueue}`,
      args: ["hello from hive"],
    });

    expect(result).toBe("hello from hive");
  });

  it("registers activities via withActivities and calls them inside a workflow", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    runner.withActivities(activities);
    await runner.run();

    const result = await runner.client.workflow.execute("greetingWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `greet-${runner.taskQueue}`,
      args: ["Hive"],
    });

    expect(result).toBe("Hello, Hive!");
  });

  it("allocates childTaskQueue and executes a parent→child workflow across two workers", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    runner.withChildWorkflowsPath(workflowsPath);
    await runner.run();

    expect(runner.childTaskQueue).toBeDefined();
    expect(runner.taskQueue).not.toBe(runner.childTaskQueue);

    const result = await runner.client.workflow.execute("parentWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `parent-${runner.taskQueue}`,
      args: ["World"],
    });

    expect(result).toBe("Child says: Hello, World!");
  });

  it("withWorkflowBundle — pre-compiled bundle works as an alternative to withWorkflowsPath", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowBundle(bundle);
    await runner.run();

    const result = await runner.client.workflow.execute("echoWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `echo-bundle-${runner.taskQueue}`,
      args: ["bundle path"],
    });

    expect(result).toBe("bundle path");
  });

  it("withChildWorkflowBundle — pre-compiled bundle used for child worker", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowBundle(bundle);
    runner.withChildWorkflowBundle(bundle);
    await runner.run();

    expect(runner.childTaskQueue).toBeDefined();
    expect(runner.taskQueue).not.toBe(runner.childTaskQueue);

    const result = await runner.client.workflow.execute("parentWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `parent-bundle-${runner.taskQueue}`,
      args: ["Bundle"],
    });

    expect(result).toBe("Child says: Hello, Bundle!");
  });
});
