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
import { ReactTestKit } from "./ReactTestKit";

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
 * Render methods provided by createReactTestRunner.
 * Parameterized by BaseKits so render() return type reflects all pre-seeded kits.
 * For createReactTestRunner, render() returns CombinedTestKitsResult<[ReactTestKit]> = RenderResult.
 * For a derived factory with more BaseKits, render() returns the richer combined type.
 */
export type ReactRenderMethods<BaseKits extends TestKitClasses> = {
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
};

function getProviderStack(testKits: TestKit[], extraProvider?: () => Wrapper): Wrapper {
  const kitStack = generateProviderStack(testKits);
  if (!extraProvider) return kitStack;
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

  const builtIn: ReactRenderMethods<ReactBaseKits> &
    ThisType<{
      run(): Promise<void> | void;
      testKits: TestKit[];
      testKitsMap: { ReactTestKit: ReactTestKit } & Record<string, TestKit>;
      result: CombinedTestKitsResult<InstanceType<(typeof REACT_BASE_KITS)[number]>[]>;
    }> = {
    render(component, options?) {
      this.run();
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

  const merged = { ...builtIn, ...(extraMethods ?? {}) };
  return createBaseTestRunner(allKits, merged as any) as any;
};
