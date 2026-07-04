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

## Authoring a Runner

Platform runners (React, Express, Temporal, …) are authored as a `const` typed against `RunnerFactory`, not a hand-written function:

```ts
export const createXTestRunner: RunnerFactory<XBaseKits, XHandle, NoMethods, XPlatformArg> = (
  kits: TestKitClasses,
  extraMethods?: ExtraMethodsShape,
  ...rest: unknown[]
) => {
  const allKits = mergeTestKits(XBaseKits, kits);
  return createBaseTestRunner(allKits, extraMethods as any, ...) as any;
};
```

- **The arrow's own params stay loose** (`TestKitClasses` / `ExtraMethodsShape`) — contextual typing does not flow from an overloaded type into an arrow's parameter list, so the body casts through `as any`/`as never` into `createBaseTestRunner`. The typed public surface comes entirely from the `RunnerFactory` annotation on the `const`, not from the arrow's own signature.
- **`RunnerFactory` is two overloads, not one optional param**, to close a real TypeScript footgun: passing literal `undefined` for `extraMethods` does not fall back to its generic default — TypeScript resolves the parameter to its _constraint_ (an index signature) instead, silently admitting any method name on the runner. So `extraMethods` is either absent entirely (kits-only overload) or required (pass `{}` to skip it); `create(kits, undefined)` matches neither overload and is a hard compile error.
- **`RunnerResult<BaseKits, KitsClasses, ExtraMethods, Handle, BaseMethods>`** is the utility type both `RunnerFactory` overloads resolve to. Reach for it directly when a runner variant can't use `RunnerFactory` as-is — e.g. it needs a per-call generic that a fixed `BaseKits` can't carry (hive-react's custom-queries variant does this for its query type).
- **Author kit-independent base methods as `(): this['result']`**, not as a generic parameterized over the caller's kit list. Polymorphic `this` re-resolves to the full merged runner result at each call site, so the method's own declared type never needs to know the caller's kits — this is what let React's `render()`/`renderComponent()` collapse onto a single fixed `RunnerFactory` instantiation instead of a bespoke generic function.
- **Use `mergeTestKits`** (not `[...a, ...b]`) to combine a runner's own base kits with the caller's — it tracks each argument as its own source rather than flattening, so a still-generic wrapper body can call its own base kits' methods even while the caller's `kits` argument is still an unresolved generic parameter. Composes at any depth: an already-merged list passed in as one of the arguments is tracked as a nested source, not re-flattened.

## API

- `createBaseTestRunner` — factory that builds a base runner from a kit-class array
- `BaseTestRunner` — the runner class returned by the factory
- `AppRunnerWithExtraMethods` — type for a runner augmented with consumer extra methods
- `RunnerThis` — `this`-type helper for kit/extra-method authoring
- `NoMethods` — marker type for a runner with no extra methods
- `NoExecuteFn` — marker type for a runner with no execute function
- `RunnerFactory` — type of a runner factory function; see "Authoring a Runner" above
- `RunnerResult` — utility type for the full merged runner shape one `RunnerFactory` call returns
- `ExtraMethodsShape` — the canonical `extraMethods` constraint (`Record<string, (...args) => unknown>`)
- `RunnerMethodMap` — type mapping kit methods onto the runner
- `mergeTestKits` / `MergeTestKits` / `MergedTestKits` — combine kit-class arrays (own base kits + caller's) without flattening away source-tracking; re-exported from `@honeybook/hive` so wrapper factories only need to import from `hive-runner`
- `TestKitClasses` — type for the array of kit classes passed to a factory

## Peer Dependencies

No peer dependencies.
