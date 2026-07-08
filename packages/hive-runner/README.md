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

Two different things get built against this package's types — a **platform runner** (React, Express, Temporal: the actual `RunnerFactory`-typed factory) and a **composer** (a function that wraps an _already-authored_ platform runner to add its own fixed base kits on top, while staying generic over whatever extra kits its own caller passes in — e.g. a per-service or per-team wrapper around `createExpressTestRunner`). They're authored differently and use different tools; conflating them is the mistake the first draft of this section made.

### A platform runner

Authored as a `const` typed against `RunnerFactory`, trimmed here from the real `createExpressTestRunner`:

```ts
const EXPRESS_BASE_KITS = [RequestConfigTestKit] as const;
type ExpressBaseKits = typeof EXPRESS_BASE_KITS; // kits this runner always includes, fixed at definition
type ExpressHandle = { request: ReturnType<typeof supertest.agent> }; // merged onto the runner by execute(), below

export const createExpressTestRunner: RunnerFactory<
  ExpressBaseKits, // BaseKits    — always-included kits (see above)
  ExpressHandle, // Handle      — execute()'s return type, merged onto the runner; NoExecuteFn if there's no execute hook
  NoMethods, // BaseMethods — fixed methods every call gets beyond kits/extraMethods; only React's render() needs this, everyone else is NoMethods
  never // PlatformArg — one trailing positional arg unique to this factory (e.g. Temporal's config); never if there isn't one
> = (kits: TestKitClasses, extraMethods?: ExtraMethodsShape) => {
  // BaseKits is a FIXED literal here (not a generic caller-supplied param), so plain array
  // spread is correct — no runner actually uses mergeTestKits for this (see Composer below).
  const allKits = [RequestConfigTestKit, ...kits];
  // RunnerFactory's outer overloaded annotation on the const specializes BaseKits/Handle/
  // BaseMethods; createBaseTestRunner's own generics don't unify with that annotation
  // directly, so the body casts through `as any` — the public typed surface a caller sees
  // is entirely the RunnerFactory annotation above, not this function's own signature.
  return createBaseTestRunner(allKits, extraMethods as any, executeHolder.execute as any) as any;
};
```

- **`RunnerFactory` is two overloads, not one optional param**, to close a real TypeScript footgun: passing literal `undefined` for `extraMethods` does not fall back to its generic default — TypeScript resolves the parameter to its _constraint_ (an index signature) instead, silently admitting any method name on the runner. So `extraMethods` is either absent entirely (kits-only overload) or required (pass `{}` to skip it); `create(kits, undefined)` matches neither overload and is a hard compile error.
- **`RunnerResult<BaseKits, KitsClasses, ExtraMethods, Handle, BaseMethods>`** is the utility type both `RunnerFactory` overloads resolve to. Reach for it directly when a runner variant can't use `RunnerFactory` as-is — e.g. it needs a per-call generic that a fixed `BaseKits` can't carry (hive-react's custom-queries variant does this for its query type).
- **Author kit-independent base methods as `(): this['result']`**, not as a generic parameterized over the caller's kit list. Polymorphic `this` re-resolves to the full merged runner result at each call site, so the method's own declared type never needs to know the caller's kits — this is what let React's `render()`/`renderComponent()` collapse onto a single fixed `RunnerFactory` instantiation instead of a bespoke generic function.

### A composer

A composer wraps a platform runner to add its own fixed base kits while staying generic over the extra kits _its own caller_ supplies — e.g. every service test suite getting `RequestConfigTestKit` plus a standard auth kit for free, on top of whatever kits an individual test adds:

```ts
const SERVICE_BASE_KITS = [AuthTestKit] as const;

function createServiceTestRunner<ExtraKits extends TestKitClasses = readonly []>(
  extraKits: ExtraKits = [] as unknown as ExtraKits,
) {
  const kits = mergeTestKits(SERVICE_BASE_KITS, extraKits);
  const runner = createExpressTestRunner(kits, {
    withAiEmployeeHeaders() {
      this.withHeaders({ "x-ai-employee": "true" }); // resolves — AuthTestKit is a concrete source
    },
  });
  runner.withApp(app); // resolves — same reason
  return runner;
}
```

**`mergeTestKits` is mandatory here, specifically** — plain `[...SERVICE_BASE_KITS, ...extraKits]` would break it. `extraKits` is still an unresolved generic parameter at the point this function's own body runs. Spreading collapses both arrays into one undifferentiated array _type_, so once any element of that array is unresolved-generic, the type checker can no longer prove _any_ element is concrete — including `AuthTestKit`, which forces `withApp`/`withHeaders` above to stop resolving too. `mergeTestKits` keeps each argument tracked as its own source (`SERVICE_BASE_KITS` stays known-concrete, `extraKits` stays generic) so the concrete source's methods keep resolving regardless of what the other source resolves to. It composes at any depth — if `extraKits` is itself already a `mergeTestKits` result from an outer wrapper layer, it's tracked as a nested source rather than re-flattened.

If you're authoring the platform runner itself instead (`BaseKits` is a fixed literal, not a generic parameter — see above), you don't need `mergeTestKits` at all; plain array spread is what all four real platform runners actually do.

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
