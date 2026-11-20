import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { createTemporalTestRunner, withEnvironment } from "@honeybook/hive-temporal";

// Opt this test file into a real dev server (TestWorkflowEnvironment.createLocal) instead of the
// default time-skipping server. Called at the top level, before beforeAll creates the env.
withEnvironment("local");

const workflowsPath = fileURLToPath(
  new URL("../testing/workflows.test-bundle.ts", import.meta.url),
);

describe("withEnvironment('local')", () => {
  it("runs workflows against a local dev server (no time skipping)", async () => {
    const runner = createTemporalTestRunner([]);
    runner.withWorkflowsPath(workflowsPath);
    await runner.run();

    expect(runner.testEnv.supportsTimeSkipping).toBe(false);
    const result = await runner.client.workflow.execute("echoWorkflow", {
      taskQueue: runner.taskQueue,
      workflowId: `echo-local-${runner.taskQueue}`,
      args: ["local"],
    });
    expect(result).toBe("local");
  });
});
