# @honeybook/hive-runner

The base test-runner factory that composes sync and async TestKits into a single memoized `run()`.

## Installation

```bash
pnpm add -D @honeybook/hive-runner
```

## Usage

```ts
import { TestKit, AsyncTestKit } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";

// Sync kit
class CounterKit extends TestKit {
  result = { count: 0 };
  get name() {
    return "CounterKit";
  }
  withCount(n: number) {
    this.result = { count: n };
  }
  defaultCallback = () => this.withCount(1);
}

// Async kit
class GreetKit extends AsyncTestKit<{ greeting: string }> {
  get name() {
    return "GreetKit";
  }
  protected async build() {
    return { greeting: "hello" };
  }
}

it("merges sync and async kit results", async () => {
  const runner = createBaseTestRunner([CounterKit, GreetKit]);
  runner.withCount(42);

  // run() is memoized — same promise, build() fires once
  const result = await runner.run();

  expect(result.count).toBe(42);
  expect(result.greeting).toBe("hello");
});
```

## API

- `createBaseTestRunner` — factory that builds a base runner from a kit-class array
- `BaseTestRunner` — the runner class returned by the factory
- `AppRunnerWithExtraMethods` — type for a runner augmented with consumer extra methods
- `RunnerThis` — `this`-type helper for kit/extra-method authoring
- `NoMethods` — marker type for a runner with no extra methods
- `NoExecuteFn` — marker type for a runner with no execute function
- `RunnerFactory` — type of a runner factory function
- `RunnerMethodMap` — type mapping kit methods onto the runner
- `KitClassArray` — type for the array of kit classes passed to the factory

## Peer Dependencies

No peer dependencies.
