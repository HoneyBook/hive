import React from "react";
import { TestKit } from "@honeybook/hive";
import type { CombinedTestKitsResult } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type { AppRunnerWithExtraMethods, TestKitClasses } from "@honeybook/hive-runner";
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
 * Render methods provided by createReactTestRunner, parameterized by the caller's full
 * merged kit list (AllKits = [...REACT_BASE_KITS, ...KitsClasses]) — not just the base
 * kits — so render/renderComponent/withBeforeRender all reflect every kit's result.
 */
export interface ReactRenderMethods<AllKits extends TestKitClasses> {
  withBeforeRender(
    callback: (result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => void,
  ): this;
  render(
    component: React.ReactElement,
    options?: RenderOptions,
  ): CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
  renderComponent(
    component:
      | React.ReactElement
      | ((result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => React.ReactElement),
    options?: RenderOptions,
  ): CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
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
 * ReactTestKit.result.ui (RenderResult) is seeded by render/renderComponent/renderHook,
 * so runner.result includes both kit results and the RTL render result under `.ui`.
 *
 * render(), renderHook(), renderComponent() call this.run() without awaiting
 * (fire-and-forget — React handles async state natively; tests use waitFor/findBy).
 * Provider stack: first kit in array = outermost provider.
 *
 * A genuine generic function (not a RunnerFactory<...>-typed const) so AllKits — the
 * caller's full merged kit list — is available inside the body, mirroring
 * createReactTestRunnerWithQueries. This is what lets render()/renderComponent()'s
 * return type (and withBeforeRender's callback param) reflect every kit's result,
 * not just REACT_BASE_KITS.
 *
 * @param kits - TestKit class array (ReactTestKit is auto-prepended via REACT_BASE_KITS).
 * @param extraMethods - Optional consumer methods. void methods chain; non-void return actual value.
 * @param getProviders - Optional extra provider factory. No arg; accesses runner state via this.
 *   Result wraps children INSIDE the kit provider stack.
 */
export function createReactTestRunner<
  KitsClasses extends TestKitClasses,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>,
>(
  kits: KitsClasses,
  extraMethods?: ExtraMethods &
    ThisType<
      AppRunnerWithExtraMethods<[...ReactBaseKits, ...KitsClasses], ExtraMethods> &
        ReactRenderMethods<[...ReactBaseKits, ...KitsClasses]>
    >,
  getProviders?: GetProviders &
    ThisType<
      AppRunnerWithExtraMethods<[...ReactBaseKits, ...KitsClasses], ExtraMethods> &
        ReactRenderMethods<[...ReactBaseKits, ...KitsClasses]>
    >,
): AppRunnerWithExtraMethods<[...ReactBaseKits, ...KitsClasses], ExtraMethods> &
  ReactRenderMethods<[...ReactBaseKits, ...KitsClasses]> {
  type AllKits = [...ReactBaseKits, ...KitsClasses];

  const allKits = [ReactTestKit, ...kits] as unknown as [...AllKits];
  const beforeRenderCallbacks: Array<
    (result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => void
  > = [];

  const builtIn: Omit<ReactRenderMethods<AllKits>, "withBeforeRender"> &
    ThisType<
      AppRunnerWithExtraMethods<AllKits, ExtraMethods> &
        ReactRenderMethods<AllKits> & {
          testKits: TestKit[];
          testKitsMap: { ReactTestKit: ReactTestKit } & Record<string, TestKit>;
          result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
        }
    > = {
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
    callback: (result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => void,
  ): void {
    beforeRenderCallbacks.push(callback);
  }

  const merged = {
    ...builtIn,
    withBeforeRender,
    ...(extraMethods ?? {}),
  } as (ExtraMethods & ReactRenderMethods<AllKits>) &
    ThisType<AppRunnerWithExtraMethods<AllKits, ExtraMethods> & ReactRenderMethods<AllKits>>;

  return createBaseTestRunner(allKits, merged) as unknown as AppRunnerWithExtraMethods<
    AllKits,
    ExtraMethods
  > &
    ReactRenderMethods<AllKits>;
}
