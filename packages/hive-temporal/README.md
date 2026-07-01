# @honeybook/hive-temporal

Temporal integration for hive — a runner that spins up a shared `TestWorkflowEnvironment`, starts workers, and executes workflows/activities.

## Installation

```bash
pnpm add -D @honeybook/hive-temporal
```

## Usage

```ts
import path from "path";
import { bundleWorkflowCode } from "@temporalio/worker";
import { createTemporalTestRunner } from "@honeybook/hive-temporal";

let bundle: any;

beforeAll(async () => {
  // Pre-bundle workflows once to avoid re-compilation on each test
  bundle = await bundleWorkflowCode({
    workflowsPath: path.resolve(__dirname, "workflows.ts"),
  });
}, 120_000);

it("executes a workflow via pre-compiled bundle", async () => {
  const runner = createTemporalTestRunner([]);
  runner.withWorkflowBundle(bundle);

  // Optionally register activities
  runner.withActivities({
    greet: async (name: string) => `hello ${name}`,
  });

  await runner.run();

  // Execute a workflow
  const result = await runner.client.workflow.execute("greetingWorkflow", {
    taskQueue: runner.taskQueue,
    workflowId: "test-123",
    args: ["World"],
  });

  expect(result).toBe("hello World");
});

it("executes an activity directly", async () => {
  const runner = createTemporalTestRunner([]);
  await runner.run();

  const add = async (a: number, b: number) => a + b;
  const result = await runner.executeActivity(add, [2, 3]);
  expect(result).toBe(5);
});
```

## API

- `createTemporalTestRunner` — factory for a Temporal test runner
- `TEMPORAL_BASE_KITS` — the base kit set injected into every Temporal runner
- `TemporalBaseKits` — type of `TEMPORAL_BASE_KITS`
- `TemporalHandle` — the live handle (`testEnv`, `client`, `taskQueue`, …) passed to hooks
- `TemporalRunnerConfig` — config object (`onReset`, `injectClients`, …) for the factory
- `TemporalTestKit` — base kit that sets up the shared workflow environment
- `TemporalTestKitResult` — result type contributed by `TemporalTestKit`
- `TemporalConfigTestKit` — kit providing `withWorkflowBundle`/`withActivities`/`withTaskQueuePrefix`
- `TemporalConfigTestKitResult` — result type contributed by `TemporalConfigTestKit`

## Peer Dependencies

No peer dependencies.
