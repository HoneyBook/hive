import { TestKit } from "@honeybook/hive";
import { queries as defaultQueries } from "@testing-library/react";
import type { Queries, RenderResult } from "@testing-library/react";

// The runner's own `.result` getter (@honeybook/hive's TestAppRunner) recomputes a fresh
// Object.assign(...) merge of every kit's `.result` on EVERY access — it is not a persistent
// object. `current`/`rerender`/`unmount` must therefore live on the KIT instance itself (like
// `ui` already does), not on a snapshot of `runner.result` — mutating a snapshot would be
// silently discarded the moment anything re-reads `runner.result`.
//
// Declared non-optional (like `ui` below) so a bare `runner.result.current` read type-checks
// even outside renderHook()'s own return type — empty/`unknown` until renderHook() is actually
// called, same "trust me, present by the time you read it" convention `ui` already uses.
// `current` is `unknown` here (the kit doesn't know the caller's Result generic); renderHook()'s
// public signature narrows it per call via `this['result'] & RenderHookResult<Result, Props>`.
interface HookResultFields {
  current: unknown;
  rerender: (props?: unknown) => void;
  unmount: () => void;
}

function unseededHookAction(): void {
  throw new Error(
    "hive-react: called .rerender()/.unmount() before renderHook() was ever called on this runner.",
  );
}

export class ReactTestKit extends TestKit {
  // ui is empty until seeded by render/renderComponent before returning; always
  // present by the time a test accesses it. Nested under `ui` (not spread onto
  // `result` directly) — RTL's RenderResult is not itself hive-react's concept
  // of a kit result, it's the raw underlying render output.
  result: { ui: RenderResult } & HookResultFields = {
    ui: {} as RenderResult,
    current: undefined,
    rerender: unseededHookAction,
    unmount: unseededHookAction,
  };
  get name() {
    return "ReactTestKit" as const;
  }
  defaultCallback = () => {};

  seedRenderResult(rtlResult: RenderResult): void {
    this.result.ui = rtlResult;
  }

  // Called on every render (initial + each rerender) — `current` must update every time.
  seedHookValue(current: unknown): void {
    this.result.current = current;
  }

  // Called once, after the initial render produces a real RTL RenderResult to bind to.
  seedHookActions(rerender: (props?: unknown) => void, unmount: () => void): void {
    this.result.rerender = rerender;
    this.result.unmount = unmount;
  }
}

export class ReactTestKitWithQueries<Q extends Queries = typeof defaultQueries> extends TestKit {
  result: { ui: RenderResult<Q> } & HookResultFields = {
    ui: {} as RenderResult<Q>,
    current: undefined,
    rerender: unseededHookAction,
    unmount: unseededHookAction,
  };
  get name() {
    return "ReactTestKitWithQueries" as const;
  }
  defaultCallback = () => {};

  seedRenderResult(rtlResult: RenderResult<Q>): void {
    this.result.ui = rtlResult;
  }

  seedHookValue(current: unknown): void {
    this.result.current = current;
  }

  seedHookActions(rerender: (props?: unknown) => void, unmount: () => void): void {
    this.result.rerender = rerender;
    this.result.unmount = unmount;
  }
}
