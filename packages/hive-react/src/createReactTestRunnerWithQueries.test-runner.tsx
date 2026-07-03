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

// A constructor type for ReactTestKitWithQueries instantiated with the caller's actual Q —
// the bare `typeof ReactTestKitWithQueries` class reference always resolves to the class's
// *default* type parameter at the type level, silently dropping any custom Q the caller
// passed to createReactTestRunnerWithQueries.
type ReactTestKitWithQueriesOf<Q extends Queries> = new () => ReactTestKitWithQueries<Q>;

interface ReactRenderMethodsQ<Q extends Queries, AllKits extends Array<new () => TestKit>> {
  withBeforeRender(
    callback: (result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => void,
  ): this;
  render(
    component?: React.ReactElement,
    options?: RenderOptions<Q>,
  ): CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
  renderComponent(
    component?:
      | React.ReactElement
      | ((result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => React.ReactElement),
    options?: RenderOptions<Q>,
  ): CombinedTestKitsResult<InstanceType<AllKits[number]>[]>;
  renderHook<Result, Props>(
    hook: (props: Props) => Result,
    options?: RenderHookOptions<Props, Q>,
  ): RenderHookResult<Result, Props>;
}

function getProviderStack(testKits: TestKit[], extraProvider?: () => Wrapper): Wrapper {
  const kitStack = generateProviderStack(testKits);
  if (!extraProvider) {
    return kitStack;
  }
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
 *
 * component is optional on render()/renderComponent() — omit it when the content
 * under test is mounted by a kit's own Provider() instead of passed explicitly;
 * the provider stack is then rendered alone via an empty fragment.
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
      AppRunnerWithExtraMethods<[ReactTestKitWithQueriesOf<Q>, ...KitsClasses], ExtraMethods> &
        ReactRenderMethodsQ<Q, [ReactTestKitWithQueriesOf<Q>, ...KitsClasses]>
    >,
  getProviders?: GetProviders &
    ThisType<
      AppRunnerWithExtraMethods<[ReactTestKitWithQueriesOf<Q>, ...KitsClasses], ExtraMethods> &
        ReactRenderMethodsQ<Q, [ReactTestKitWithQueriesOf<Q>, ...KitsClasses]>
    >,
  customQueries?: Q,
): AppRunnerWithExtraMethods<[ReactTestKitWithQueriesOf<Q>, ...KitsClasses], ExtraMethods> &
  ReactRenderMethodsQ<Q, [ReactTestKitWithQueriesOf<Q>, ...KitsClasses]> {
  type AllKits = [ReactTestKitWithQueriesOf<Q>, ...KitsClasses];

  // ReactTestKitWithQueries is generic but we instantiate it as a bare class constructor
  // here — same class at runtime regardless of Q. AllKits[0] (ReactTestKitWithQueriesOf<Q>)
  // is what carries Q at the type level; the cast below only bridges the runtime bare-class
  // reference to that type, it isn't what makes Q flow through.
  const allKits = [ReactTestKitWithQueries, ...kits] as unknown as [...AllKits];
  const beforeRenderCallbacks: Array<
    (result: CombinedTestKitsResult<InstanceType<AllKits[number]>[]>) => void
  > = [];

  const renderOptions = customQueries ? { queries: customQueries } : {};

  const builtIn: Omit<ReactRenderMethodsQ<Q, AllKits>, "withBeforeRender"> &
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
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      // No component means the content under test lives inside a kit's Provider() —
      // render the provider stack alone via an empty fragment, matching the
      // long-standing zero-arg convention this factory replaces.
      const rtlResult = rtlRender(component ?? <></>, {
        wrapper: Wrapper,
        ...renderOptions,
        ...options,
      } as RenderOptions<Q>) as RenderResult<Q>;
      this.testKitsMap.ReactTestKitWithQueries.seedRenderResult(rtlResult);
      return this.result;
    },
    renderComponent(component, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      const element =
        typeof component === "function" ? component(this.result) : (component ?? <></>);
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
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(
        this.testKits,
        getProviders ? (getProviders as () => Wrapper).bind(this) : undefined,
      );
      return rtlRenderHook(hook, { wrapper: Wrapper, ...renderOptions, ...options });
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
  } as (ExtraMethods & ReactRenderMethodsQ<Q, AllKits>) &
    ThisType<AppRunnerWithExtraMethods<AllKits, ExtraMethods> & ReactRenderMethodsQ<Q, AllKits>>;

  return createBaseTestRunner(allKits, merged) as unknown as AppRunnerWithExtraMethods<
    AllKits,
    ExtraMethods
  > &
    ReactRenderMethodsQ<Q, AllKits>;
}
