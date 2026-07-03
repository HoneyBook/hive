import React from "react";
import { TestKit } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type { RunnerFactory, NoExecuteFn, TestKitClasses } from "@honeybook/hive-runner";
import type { CombinedTestKitsResult } from "@honeybook/hive";
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
type GetProviders = () => Wrapper;

/**
 * Base kits always prepended by createReactTestRunner.
 * Export so downstream factories can extend: [...REACT_BASE_KITS, ...MY_BASE_KITS].
 */
export const REACT_BASE_KITS = [ReactTestKit] as const;
export type ReactBaseKits = typeof REACT_BASE_KITS;

/**
 * Extracts the actual, fully-merged `result` type off the polymorphic `this` at each call
 * site (base kits + whatever extra kits the caller passed to createReactTestRunner) — self-
 * inferring, not pinned to BaseKits alone. Only used by withBeforeRender: unlike render/
 * renderComponent/renderHook, its body needs no internal `this.testKits`/`this.run()` access,
 * so it isn't constrained by the object-literal+ThisType<> requirement those methods have
 * (see createTemporalTestRunner.test-runner.ts's comment on that requirement) and can
 * reference the real per-call-site `this` directly.
 */
type SelfResult<Self> = Self extends { result: infer R } ? R : never;

/**
 * Render methods provided by createReactTestRunner.
 * render/renderComponent/renderHook are scoped to BaseKits only (pre-existing, unrelated to
 * withBeforeRender — see discussion for a tracked follow-up to widen them the same way).
 */
export interface ReactRenderMethods<BaseKits extends TestKitClasses> {
  withBeforeRender(callback: (result: SelfResult<this>) => void): this;
  render(
    component: React.ReactElement,
    options?: RenderOptions,
  ): CombinedTestKitsResult<InstanceType<BaseKits[number]>[]>;
  renderComponent(
    component:
      | React.ReactElement
      | ((result: CombinedTestKitsResult<InstanceType<BaseKits[number]>[]>) => React.ReactElement),
    options?: RenderOptions,
  ): CombinedTestKitsResult<InstanceType<BaseKits[number]>[]>;
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

/**
 * createReactTestRunner — React platform runner factory.
 *
 * Always prepends ReactTestKit (via REACT_BASE_KITS) to the kit list.
 * ReactTestKit.result (RenderResult) is seeded by render/renderComponent/renderHook,
 * so runner.result includes both kit results AND RTL query functions.
 *
 * render(), renderHook(), renderComponent() call this.run() without awaiting
 * (fire-and-forget — React handles async state natively; tests use waitFor/findBy).
 * Provider stack: first kit in array = outermost provider.
 *
 * @param kits - TestKit class array (ReactTestKit is auto-prepended via REACT_BASE_KITS).
 * @param extraMethods - Optional consumer methods. void methods chain; non-void return actual value.
 * @param getProviders - Optional extra provider factory. No arg; accesses runner state via this.
 *   Result wraps children INSIDE the kit provider stack.
 */
export const createReactTestRunner: RunnerFactory<
  ReactBaseKits,
  NoExecuteFn,
  ReactRenderMethods<ReactBaseKits>,
  GetProviders
> = (kits, extraMethods, getProviders) => {
  const allKits = [ReactTestKit, ...kits];
  const beforeRenderCallbacks: Array<
    (result: CombinedTestKitsResult<InstanceType<ReactBaseKits[number]>[]>) => void
  > = [];

  const builtIn: Omit<ReactRenderMethods<ReactBaseKits>, "withBeforeRender"> &
    ThisType<{
      run(): Promise<void> | void;
      testKits: TestKit[];
      testKitsMap: { ReactTestKit: ReactTestKit } & Record<string, TestKit>;
      result: CombinedTestKitsResult<InstanceType<(typeof REACT_BASE_KITS)[number]>[]>;
    }> = {
    render(component, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      const rtlResult = rtlRender(component, { wrapper: Wrapper, ...options } as RenderOptions);
      this.testKitsMap.ReactTestKit.seedRenderResult(rtlResult);
      return this.result;
    },
    renderComponent(component, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      const element = typeof component === "function" ? component(this.result) : component;
      const rtlResult = rtlRender(element, { wrapper: Wrapper, ...options } as RenderOptions);
      this.testKitsMap.ReactTestKit.seedRenderResult(rtlResult);
      return this.result;
    },
    renderHook(hook, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      const rtlResult = rtlRenderHook(hook, { wrapper: Wrapper, ...options });
      // renderHook result is not a RenderResult — seed as-is for reference; cast required.
      this.testKitsMap.ReactTestKit.seedRenderResult(rtlResult as unknown as RenderResult);
      return rtlResult;
    },
  };

  // Declared to return void (not `this`) — createBaseTestRunner's extraMethods wrapper
  // upgrades a void return to `this` at runtime, matching kit with* chaining. A `this`-typed
  // return here conflicts with the ThisType<> override on `builtIn` (TS2719).
  function withBeforeRender(
    callback: (result: CombinedTestKitsResult<InstanceType<ReactBaseKits[number]>[]>) => void,
  ): void {
    beforeRenderCallbacks.push(callback);
  }

  const merged = { ...builtIn, withBeforeRender, ...(extraMethods ?? {}) };
  return createBaseTestRunner(allKits, merged as any) as any;
};
