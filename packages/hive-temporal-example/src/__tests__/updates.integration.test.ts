import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { WithStartWorkflowOperation } from "@temporalio/client";
import { createTemporalTestRunner } from "@honeybook/hive-temporal";
import { addUpdate, finishSignal, incrementSignal, valueQuery } from "../counterWorkflow.js";

const workflowsPath = fileURLToPath(
  new URL("../testing/workflows.test-bundle.ts", import.meta.url),
);

describe("signals, queries and updates through runner.client", () => {
  it("executeUpdateWithStart starts the workflow and applies the update atomically", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    await runner.run();

    const workflowId = `counter-uws-${runner.taskQueue}`;
    const startWorkflowOperation = new WithStartWorkflowOperation("counterWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId,
      args: [10],
      workflowIdConflictPolicy: "USE_EXISTING",
    });

    // First call starts the workflow (initial 10) and applies the update (+5).
    const first = await runner.client.workflow.executeUpdateWithStart(addUpdate, {
      args: [5],
      startWorkflowOperation,
    });
    expect(first).toBe(15);

    // Second call reuses the running workflow (USE_EXISTING) and applies another update.
    const second = await runner.client.workflow.executeUpdateWithStart(addUpdate, {
      args: [2],
      startWorkflowOperation: new WithStartWorkflowOperation("counterWorkflow", {
        taskQueue: runner.taskQueue,
        workflowId,
        args: [10],
        workflowIdConflictPolicy: "USE_EXISTING",
      }),
    });
    expect(second).toBe(17);

    const handle = await startWorkflowOperation.workflowHandle();
    expect(await handle.query(valueQuery)).toBe(17);
    await handle.signal(finishSignal);
    expect(await handle.result()).toBe(17);
  });

  it("signals, queries and updates on a started workflow", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    await runner.run();

    const handle = await runner.client.workflow.start("counterWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `counter-${runner.taskQueue}`,
    });
    await handle.signal(incrementSignal, 3);
    expect(await handle.executeUpdate(addUpdate, { args: [4] })).toBe(7);
    expect(await handle.query(valueQuery)).toBe(7);
    await handle.signal(finishSignal);
    expect(await handle.result()).toBe(7);
  });
});
