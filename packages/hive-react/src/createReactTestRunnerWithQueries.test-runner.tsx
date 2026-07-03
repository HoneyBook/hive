import React from "react";
import { TestKit } from "@honeybook/hive";
import type { CombinedTestKitsResult } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type {
  AppRunnerWithExtraMethods,
  ExtraMethodsShape,
  TestKitClasses,
} from "@honeybook/hive-runner";
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
// passed (see discussions/13). AllKits[0] carrying Q is what threads it into the result type.
type ReactTestKitWithQueriesOf<Q extends Queries> = new () => ReactTestKitWithQueries<Q>;

/**
 * Render methods for the custom-queries variant. Like ReactRenderMethods, they are
 * result-shape-independent (render/renderComponent return `this['result']`, so the merged
 * result of every kit flows through with no AllKits generic). The ONE thing they still
 * parameterize on is Q — the custom RTL query set — because `options?: RenderOptions<Q>`
 * and renderHook's options genuinely depend on it. `extends { result: unknown }` makes
 * `this['result']` valid at the declaration; it narrows at the intersection use-site.
 */
export interface ReactRenderMethodsQ<Q extends Queries> {
  result: unknown;
  withBeforeRender(callback: (result: this["result"]) => void): this;
  render(component?: React.ReactElement, options?: RenderOptions<Q>): this["result"];
  renderComponent(
    component?: React.ReactElement | ((result: this["result"]) => React.ReactElement),
    options?: RenderOptions<Q>,
  ): this["result"];
  renderHook<Result, Props>(
    hook: (props: Props) => Result,
    options?: RenderHookOptions<Props, Q>,
  ): RenderHookResult<Result, Props>;
}

// Full public runner type for one call. Uses a plain tuple `[ReactTestKitWithQueriesOf<Q>,
// ...KitsClasses]` (not MergeTestKits) — Q must be threaded through AllKits[0], which is the
// discussion-13 Bug-2 fix; wrapper-of-wrapper composition is not a concern for this variant.
type ReactRunnerWithQueries<
  KitsClasses extends TestKitClasses,
  ExtraMethods extends object,
  Q extends Queries,
> = AppRunnerWithExtraMethods<[ReactTestKitWithQueriesOf<Q>, ...KitsClasses], ExtraMethods> &
  ReactRenderMethodsQ<Q>;

// The `this` a render-method implementation sees inside the factory body — fixed to the
// Q-typed base kit (Q IS in scope here because this is a genuine generic function, which is
// exactly why this variant can't be a fixed RunnerFactory instantiation).
type ReactRunnerThisWithQueries<Q extends Queries> = ReactRenderMethodsQ<Q> & {
  run(): Promise<CombinedTestKitsResult<[ReactTestKitWithQueries<Q>]>>;
  testKits: TestKit[];
  testKitsMap: { ReactTestKitWithQueries: ReactTestKitWithQueries<Q> } & Record<string, TestKit>;
  result: CombinedTestKitsResult<[ReactTestKitWithQueries<Q>]>;
};

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
 * A genuine generic function (over KitsClasses, ExtraMethods, Q) rather than a fixed
 * RunnerFactory instantiation, because Q determines the base kit's identity
 * (ReactTestKitWithQueries<Q>) and the render options type (RenderOptions<Q>) — neither of
 * which a fixed RunnerFactory `BaseKits` can carry. It reuses the same `this['result']`
 * render-method pattern and inherits the same two-overload ban on extraMethods (skip it with
 * `{}`, never `undefined`), authored explicitly here since RunnerFactory can't supply it.
 *
 * @param kits - TestKit class array (ReactTestKitWithQueries is auto-prepended).
 * @param extraMethods - Consumer methods (void = chainable, non-void = returns value).
 *   Required whenever getProviders/customQueries follow — pass `{}` to skip it.
 * @param getProviders - Optional extra provider factory (no arg; accesses runner via this).
 * @param customQueries - Custom RTL query object. When provided, render/renderHook return
 *   results typed to Q instead of the default query set.
 *
 * component is optional on render()/renderComponent() — omit it when the content under test
 * is mounted by a kit's own Provider() instead of passed explicitly.
 */
export function createReactTestRunnerWithQueries<KitsClasses extends TestKitClasses>(
  kits: KitsClasses,
): ReactRunnerWithQueries<KitsClasses, Record<never, never>, typeof defaultQueries>;
export function createReactTestRunnerWithQueries<
  KitsClasses extends TestKitClasses,
  ExtraMethods extends object,
  Q extends Queries = typeof defaultQueries,
>(
  kits: KitsClasses,
  extraMethods: ExtraMethods & ThisType<ReactRunnerWithQueries<KitsClasses, ExtraMethods, Q>>,
  getProviders?: GetProviders & ThisType<ReactRunnerWithQueries<KitsClasses, ExtraMethods, Q>>,
  customQueries?: Q,
): ReactRunnerWithQueries<KitsClasses, ExtraMethods, Q>;
export function createReactTestRunnerWithQueries<
  KitsClasses extends TestKitClasses,
  ExtraMethods extends object = Record<never, never>,
  Q extends Queries = typeof defaultQueries,
>(
  kits: KitsClasses,
  extraMethods?: ExtraMethods & ThisType<ReactRunnerWithQueries<KitsClasses, ExtraMethods, Q>>,
  getProviders?: GetProviders & ThisType<ReactRunnerWithQueries<KitsClasses, ExtraMethods, Q>>,
  customQueries?: Q,
): ReactRunnerWithQueries<KitsClasses, ExtraMethods, Q> {
  const allKits = [ReactTestKitWithQueries, ...kits];
  const beforeRenderCallbacks: Array<(result: ReactRunnerThisWithQueries<Q>["result"]) => void> =
    [];
  const renderOptions = customQueries ? { queries: customQueries } : {};

  const builtIn: Omit<ReactRenderMethodsQ<Q>, "withBeforeRender" | "result"> &
    ThisType<ReactRunnerThisWithQueries<Q>> = {
    render(component, options?) {
      this.run();
      beforeRenderCallbacks.forEach((cb) => cb(this.result));
      const Wrapper = getProviderStack(this.testKits, (getProviders as GetProviders)?.bind(this));
      // No component means the content under test lives inside a kit's Provider() —
      // render the provider stack alone via an empty fragment (old zero-arg convention).
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
      const Wrapper = getProviderStack(this.testKits, (getProviders as GetProviders)?.bind(this));
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
      const Wrapper = getProviderStack(this.testKits, (getProviders as GetProviders)?.bind(this));
      return rtlRenderHook(hook, { wrapper: Wrapper, ...renderOptions, ...options });
    },
  };

  // Declared to return void (not `this`) — createBaseTestRunner's extraMethods wrapper
  // upgrades a void return to `this` at runtime, matching kit with* chaining.
  function withBeforeRender(
    callback: (result: ReactRunnerThisWithQueries<Q>["result"]) => void,
  ): void {
    beforeRenderCallbacks.push(callback);
  }

  const merged = { ...builtIn, withBeforeRender, ...(extraMethods ?? {}) } as ExtraMethodsShape;

  return createBaseTestRunner(allKits, merged) as never;
}
