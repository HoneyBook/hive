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

## Peer dependencies and SDK versions

`@temporalio/testing` and `@temporalio/worker` are **peer dependencies** (`>=1.20.1 <2`). The
package uses _your_ Temporal SDK, so there is only one copy of the worker/runtime in your tree.
This repo's own tests run against 1.20.1 (the example suite also passes unchanged on 1.26.0); consumers on newer 1.x work unchanged. pnpm and
npm 7+ install peers automatically, but pin the two packages (and `@temporalio/client`,
`@temporalio/workflow`) to the same version in your own `package.json`.

## Test frameworks and hooks

The kit registers `beforeAll` / `afterAll` / `beforeEach`. By default it uses the globals, so it
works with jest and with vitest `globals: true` (verified with vitest 5 in
`packages/hive-temporal-example`).

With vitest `globals: false`, pass the functions explicitly, once per test file, before using a
runner (the shared environment is started in `beforeAll`, which is registered as soon as the
functions are known):

```ts
import { beforeAll, afterAll, beforeEach } from "vitest";
import { configureTemporalTestHooks, createTemporalTestRunner } from "@honeybook/hive-temporal";

configureTemporalTestHooks({ beforeAll, afterAll, beforeEach });
```

## Choosing the test environment

The default is a time-skipping server (`TestWorkflowEnvironment.createTimeSkipping()`). A test
file can opt into a real dev server (`createLocal()`) instead — call it at the top level of the
file, before the tests run. The choice is per test file:

```ts
import { withEnvironment } from "@honeybook/hive-temporal";

withEnvironment("local"); // or withEnvironment("local", { server: { executable: { type: "existing-path", path } } })
```

`runner.testEnv.supportsTimeSkipping` tells which one you got. The local server downloads the
Temporal CLI on first use (cached afterwards).

## Replaying histories (determinism checks)

`replayHistories` wraps `Worker.runReplayHistories`. It accepts histories as
`{ workflowId, history }` objects (e.g. `await handle.fetchHistory()`) or as paths to JSON
history files (e.g. from `temporal workflow show --output json`), and throws one error that
names every failing workflow id and its cause (non-determinism, etc.):

```ts
const runner = createTemporalTestRunner([]);
runner.withWorkflowBundle(bundle);
await runner.run();

// Uses the runner's workflow code unless you pass workflowsPath / workflowBundle.
await runner.replayHistories([{ workflowId, history }, "./histories/order-123.json"]);

// Or standalone, e.g. against the code under test:
import { replayHistories } from "@honeybook/hive-temporal";
await replayHistories(["./histories/order-123.json"], {
  workflowsPath: require.resolve("./workflows"),
});
// throws: [hive-temporal] replay failed for 1 of 1 histories:
//   workflow "order-123" (run ...): DeterminismViolationError: ...
```

## Signals, queries, updates and Update-with-Start

`runner.client` is the SDK `Client` of the test environment, so the whole workflow API is
available. Use the runner's `taskQueue` for anything you start:

```ts
import { WithStartWorkflowOperation } from "@temporalio/client";

const handle = await runner.client.workflow.start("counterWorkflow", {
  taskQueue: runner.taskQueue,
  workflowId: "counter-1",
});
await handle.signal(incrementSignal, 3);
await handle.query(valueQuery); // 3
await handle.executeUpdate(addUpdate, { args: [4] }); // 7

// Update-with-Start: start the workflow (if needed) and apply an update atomically.
const startWorkflowOperation = new WithStartWorkflowOperation("counterWorkflow", {
  taskQueue: runner.taskQueue,
  workflowId: "counter-2",
  args: [10],
  workflowIdConflictPolicy: "USE_EXISTING", // required
});
const value = await runner.client.workflow.executeUpdateWithStart(addUpdate, {
  args: [5],
  startWorkflowOperation,
}); // 15
const wf = await startWorkflowOperation.workflowHandle();
```

Runnable versions: `packages/hive-temporal-example/src/__tests__/` (`updates`, `replay`,
`local-env`).

## API

- `createTemporalTestRunner` — factory for a Temporal test runner
- `TEMPORAL_BASE_KITS` — the base kit set injected into every Temporal runner
- `TemporalBaseKits` — type of `TEMPORAL_BASE_KITS`
- `TemporalHandle` — the live handle (`testEnv`, `client`, `taskQueue`, `replayHistories`, …) passed to hooks
- `TemporalRunnerConfig` — config object (`onReset`, `injectClients`, …) for the factory
- `TemporalTestKit` — base kit that sets up the shared workflow environment
- `TemporalTestKitResult` — result type contributed by `TemporalTestKit`
- `TemporalConfigTestKit` — kit providing `withWorkflowBundle`/`withActivities`/`withTaskQueuePrefix`
- `TemporalConfigTestKitResult` — result type contributed by `TemporalConfigTestKit`
- `withEnvironment` — choose `"time-skipping"` (default) or `"local"` for this test file
- `replayHistories` — replay histories against workflow code; throws naming failing workflow ids
- `configureTemporalTestHooks` — pass `beforeAll`/`afterAll`/`beforeEach` explicitly (vitest without globals)
