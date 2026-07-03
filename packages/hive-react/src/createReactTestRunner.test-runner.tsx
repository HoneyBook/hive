import React from "react";
import { TestKit } from "@honeybook/hive";
import type { CombinedTestKitsResult } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type {
  ExtraMethodsShape,
  NoExecuteFn,
  RunnerFactory,
  TestKitClasses,
} from "@honeybook/hive-runner";
import { render as rtlRender, renderHook as rtlRenderHook } from "@testing-library/react";
import type {
  RenderOptions,
  RenderResult,
  RenderHookOptions,
  RenderHookResult,
} from "@testing-library/react";
import { generateProviderStack } from "./generateProviderStack";
import { ReactTestKit } from "./ReactTestKit.test-kit";

type Wrapper = NonNullable<RenderOptions["wrapper"]>;

// GetProviders: no arg, returns a Wrapper. Bound to runner this via ThisType<> at call site.
// This is createReactTestRunner's PlatformArg (the optional trailing factory param).
type GetProviders = () => Wrapper;

/**
 * Base kits always prepended by createReactTestRunner.
 * Export so downstream factories can extend: [...REACT_BASE_KITS, ...MY_BASE_KITS].
 */
export const REACT_BASE_KITS = [ReactTestKit] as const;
export type ReactBaseKits = typeof REACT_BASE_KITS;

/**
 * Render methods provided by createReactTestRunner.
 *
 * These are kit-INDEPENDENT: render/renderComponent return `this['result']` and
 * withBeforeRender's callback receives `this['result']`, rather than a per-call
 * `CombinedTestKitsResult<AllKits>`. Polymorphic `this` re-resolves to the full
 * merged runner at every call site, so `this['result']` IS the merged result of
 * every kit (base + caller) — with no generic AllKits parameter. That is what lets
 * createReactTestRunner be a FIXED `RunnerFactory<...>` instantiation (below) instead
 * of a bespoke generic function drowning in repeated ThisType<...> boilerplate.
 *
 * `extends { result: unknown }` exists only so `this['result']` is syntactically valid
 * at the declaration; `unknown & CombinedTestKitsResult<...>` collapses to the real
 * merged result at the intersection use-site (see RunnerResult in @honeybook/hive-runner).
 */
export interface ReactRenderMethods {
  result: unknown;
  withBeforeRender(callback: (result: this["result"]) => void): this;
  render(component?: React.ReactElement, options?: RenderOptions): this["result"];
  renderComponent(
    component?: React.ReactElement | ((result: this["result"]) => React.ReactElement),
    options?: RenderOptions,
  ): this["result"];
  renderHook<Result, Props>(
    hook: (props: Props) => Result,
    options?: RenderHookOptions<Props>,
  ): RenderHookResult<Result, Props>;
}

function getProviderStack(testKits: TestKit[], extraProvider?: () => Wrapper): Wrapper {
  const kitStack = generateProviderStack(testKits);
  if (!extraProvider) {
    return kitStack;
  }
  // Lazy — extraProvider() called inside the returned Wrapper, at React render time
  const KitStack = kitStack;
  const Wrapped: Wrapper = ({ children }) => {
    const ExtraProvider = extraProvider();
    return (
      <KitStack>
        <ExtraProvider>{children}</ExtraProvider>
      </KitStack>
    );
  };
  return Wrapped;
}

// The `this` a render-method implementation sees inside the factory body. Fixed to the
// BASE kits (known at definition time) — the implementations only touch this.run(),
// this.result, this.testKits and this.testKitsMap.ReactTestKit, never the caller's extra
// kits. The public per-call `this` (with every merged kit) comes from the RunnerFactory
// annotation, not from here.
type ReactRunnerThis = ReactRenderMethods & {
  run(): Promise<CombinedTestKitsResult<InstanceType<ReactBaseKits[number]>[]>>;
  testKits: TestKit[];
  testKitsMap: { ReactTestKit: ReactTestKit } & Record<string, TestKit>;
  result: CombinedTestKitsResult<InstanceType<ReactBaseKits[number]>[]>;
};

/**
 * createReactTestRunner — React platform runner factory.
 *
 * Always prepends ReactTestKit (via REACT_BASE_KITS) to the kit list.
 * ReactTestKit.result.ui (RenderResult) is seeded by render/renderComponent/renderHook,
 * so runner.result includes both kit results and the RTL render result under `.ui`.
 *
 * render(), renderHook(), renderComponent() call this.run() without awaiting
 * (fire-and-forget — React handles async state natively; tests use waitFor/findBy).
 * Provider stack: first kit in array = outermost provider.
 *
 * component is optional on render()/renderComponent() — omit it when the content
 * under test is mounted by a kit's own Provider() instead of passed explicitly;
 * the provider stack is then rendered alone via an empty fragment.
 *
 * Authored as a fixed `RunnerFactory` instantiation:
 * - ReactBaseKits    — the auto-prepended base kit list.
 * - NoExecuteFn      — no execute hook / handle.
 * - ReactRenderMethods — the kit-independent (this['result']-based) render methods.
 * - GetProviders     — the optional trailing PlatformArg.
 *
 * The two-overload ban on extraMethods (skip it with `{}`, never `undefined`) is inherited
 * from RunnerFactory — see @honeybook/hive-runner's types.ts.
 *
 * @param kits - TestKit class array (ReactTestKit is auto-prepended via REACT_BASE_KITS).
 * @param extraMethods - Consumer methods. void methods chain; non-void return their value.
 *   Required whenever getProviders is passed — pass `{}` to skip it.
 * @param getProviders - Optional extra provider factory. No arg; accesses runner state via this.
 *   Result wraps children INSIDE the kit provider stack.
 */
export const createReactTestRunner: RunnerFactory<
  ReactBaseKits,
  NoExecuteFn,
  ReactRenderMethods,
  GetProviders
> = (kits: TestKitClasses, extraMethods?: ExtraMethodsShape, getProviders?: GetProviders) => {
  const allKits = [ReactTestKit, ...kits];
  const beforeRenderCallbacks: Array<(result: ReactRunnerThis["result"]) => void> = [];

  const builtIn: Omit<ReactRenderMethods, "withBeforeRender" | "result"> &
    ThisType<ReactRunnerThis> = {
    render(component, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(this.testKits, getProviders?.bind(this));
      // No component means the content under test lives inside a kit's Provider() —
      // render the provider stack alone via an empty fragment, matching the
      // long-standing zero-arg convention this factory replaces.
      const rtlResult = rtlRender(component ?? <></>, {
        wrapper: Wrapper,
        ...options,
      } as RenderOptions);
      this.testKitsMap.ReactTestKit.seedRenderResult(rtlResult);
      return this.result;
    },
    renderComponent(component, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(this.testKits, getProviders?.bind(this));
      const element =
        typeof component === "function" ? component(this.result) : (component ?? <></>);
      const rtlResult = rtlRender(element, { wrapper: Wrapper, ...options } as RenderOptions);
      this.testKitsMap.ReactTestKit.seedRenderResult(rtlResult);
      return this.result;
    },
    renderHook(hook, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(this.testKits, getProviders?.bind(this));
      const rtlResult = rtlRenderHook(hook, { wrapper: Wrapper, ...options });
      // renderHook result is not a RenderResult — seed as-is for reference; cast required.
      this.testKitsMap.ReactTestKit.seedRenderResult(rtlResult as unknown as RenderResult);
      return rtlResult;
    },
  };

  // Declared to return void (not `this`) — createBaseTestRunner's extraMethods wrapper
  // upgrades a void return to `this` at runtime, matching kit with* chaining. A `this`-typed
  // return here conflicts with the ThisType<> override on `builtIn` (TS2719).
  function withBeforeRender(callback: (result: ReactRunnerThis["result"]) => void): void {
    beforeRenderCallbacks.push(callback);
  }

  const merged = { ...builtIn, withBeforeRender, ...(extraMethods ?? {}) } as ExtraMethodsShape;

  return createBaseTestRunner(allKits, merged) as never;
};
