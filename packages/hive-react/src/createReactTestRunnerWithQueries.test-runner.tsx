import React from "react";
import { TestKit } from "@honeybook/hive";
import type { CombinedTestKitsResult } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type { AppRunnerWithExtraMethods, TestKitClasses } from "@honeybook/hive-runner";
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  queries as defaultQueries,
} from "@testing-library/react";
import type {
  Queries,
  RenderOptions,
  RenderResult,
  RenderHookOptions,
  RenderHookResult,
} from "@testing-library/react";
import { generateProviderStack } from "./generateProviderStack";
import { ReactTestKitWithQueries } from "./ReactTestKit.test-kit";

type Wrapper = NonNullable<RenderOptions["wrapper"]>;

// GetProviders: no arg, returns a Wrapper. Bound to runner this via ThisType<> at call site.
type GetProviders = () => Wrapper;

type ReactRenderMethodsQ<Q extends Queries, AllKits extends Array<new () => TestKit>> = {
  render(
    component: React.ReactElement,
    options?: RenderOptions<Q>,
  ): CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
  renderComponent(
    component:
      | React.ReactElement
      | ((result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => React.ReactElement),
    options?: RenderOptions<Q>,
  ): CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
  renderHook<Result, Props>(
    hook: (props: Props) => Result,
    options?: RenderHookOptions<Props, Q>,
  ): RenderHookResult<Result, Props>;
};

function getProviderStack(testKits: TestKit[], extraProvider?: () => Wrapper): Wrapper {
  const kitStack = generateProviderStack(testKits);
  if (!extraProvider) return kitStack;
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
 * Like createReactTestRunner, but accepts custom RTL queries (Q).
 * Auto-prepends ReactTestKitWithQueries<Q> to the kit list.
 * Use when you need custom query methods beyond the default set.
 *
 * @param kits - TestKit class array (ReactTestKitWithQueries is auto-prepended).
 * @param extraMethods - Optional consumer methods (void = chainable, non-void = returns value).
 * @param getProviders - Optional extra provider factory (no arg; accesses runner via this).
 * @param customQueries - Custom RTL query object. When provided, render/renderHook return results
 *   typed to Q instead of the default query set.
 */
export function createReactTestRunnerWithQueries<
  KitsClasses extends TestKitClasses,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>,
  Q extends Queries = typeof defaultQueries,
>(
  kits: KitsClasses,
  extraMethods?: ExtraMethods &
    ThisType<
      AppRunnerWithExtraMethods<[typeof ReactTestKitWithQueries, ...KitsClasses], ExtraMethods> &
        ReactRenderMethodsQ<Q, [typeof ReactTestKitWithQueries, ...KitsClasses]>
    >,
  getProviders?: GetProviders &
    ThisType<
      AppRunnerWithExtraMethods<[typeof ReactTestKitWithQueries, ...KitsClasses], ExtraMethods> &
        ReactRenderMethodsQ<Q, [typeof ReactTestKitWithQueries, ...KitsClasses]>
    >,
  customQueries?: Q,
): AppRunnerWithExtraMethods<[typeof ReactTestKitWithQueries, ...KitsClasses], ExtraMethods> &
  ReactRenderMethodsQ<Q, [typeof ReactTestKitWithQueries, ...KitsClasses]> {
  type AllKits = [typeof ReactTestKitWithQueries, ...KitsClasses];

  // ReactTestKitWithQueries is generic but we instantiate it as a class constructor here.
  // The type parameter Q flows through RenderResult<Q> via seedRenderResult.
  const allKits = [ReactTestKitWithQueries, ...kits] as unknown as [...AllKits];

  const renderOptions = customQueries ? { queries: customQueries } : {};

  const builtIn: ReactRenderMethodsQ<Q, AllKits> &
    ThisType<
      AppRunnerWithExtraMethods<AllKits, ExtraMethods> &
        ReactRenderMethodsQ<Q, AllKits> & {
          testKits: TestKit[];
          testKitsMap: { ReactTestKitWithQueries: ReactTestKitWithQueries<Q> } & Record<
            string,
            TestKit
          >;
          result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
        }
    > = {
    render(component, options?) {
      this.run();
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      const rtlResult = rtlRender(component, {
        wrapper: Wrapper,
        ...renderOptions,
        ...options,
      } as RenderOptions<Q>) as RenderResult<Q>;
      this.testKitsMap.ReactTestKitWithQueries.seedRenderResult(rtlResult);
      return this.result;
    },
    renderComponent(component, options?) {
      this.run();
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      const element = typeof component === "function" ? component(this.result) : component;
      const rtlResult = rtlRender(element, {
        wrapper: Wrapper,
        ...renderOptions,
        ...options,
      } as RenderOptions<Q>) as RenderResult<Q>;
      this.testKitsMap.ReactTestKitWithQueries.seedRenderResult(rtlResult);
      return this.result;
    },
    renderHook(hook, options?) {
      this.run();
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      return rtlRenderHook(hook, { wrapper: Wrapper, ...renderOptions, ...options });
    },
  };

  const merged = {
    ...builtIn,
    ...(extraMethods ?? {}),
  } as (ExtraMethods & ReactRenderMethodsQ<Q, AllKits>) &
    ThisType<AppRunnerWithExtraMethods<AllKits, ExtraMethods> & ReactRenderMethodsQ<Q, AllKits>>;

  return createBaseTestRunner(allKits, merged) as unknown as AppRunnerWithExtraMethods<
    AllKits,
    ExtraMethods
  > &
    ReactRenderMethodsQ<Q, AllKits>;
}
