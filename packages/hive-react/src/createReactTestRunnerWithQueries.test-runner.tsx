import React from "react";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type {
  AppRunnerWithExtraMethods,
  ExtraMethodsShape,
  TestKitClasses,
} from "@honeybook/hive-runner";
import { queries as defaultQueries } from "@testing-library/react";
import type { Queries, RenderOptions } from "@testing-library/react";
import { createReactRenderMethods } from "./reactRenderMethods";
import type { GetProviders, RenderHookOptions, RenderHookResult } from "./reactRenderMethods";
import { ReactTestKitWithQueries } from "./ReactTestKit.test-kit";

// A constructor type for ReactTestKitWithQueries instantiated with the caller's actual Q. The
// bare `typeof ReactTestKitWithQueries` class reference always resolves to the class's *default*
// type parameter at the type level, silently dropping any custom Q (see discussions/13, Bug 2).
// Making AllKits[0] this Q-carrying constructor is what threads Q into the result type.
type ReactTestKitWithQueriesOf<Q extends Queries> = new () => ReactTestKitWithQueries<Q>;

/**
 * Render methods for the custom-queries variant. Like ReactRenderMethods they are
 * result-shape-independent (render/renderComponent return `this['result']`, so the merged
 * result of every kit flows through with no AllKits generic). The one thing they parameterize
 * on is Q — the custom RTL query set — because `options?: RenderOptions<Q>` genuinely depends
 * on it (renderHook doesn't expose query methods on its result either way, so its
 * RenderHookOptions/RenderHookResult — homegrown in ./reactRenderMethods, not from RTL, see
 * there — stay Q-independent). `extends { result: unknown }` makes `this['result']` valid at
 * the declaration; it narrows at the intersection use-site.
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
    options?: RenderHookOptions<Props>,
  ): RenderHookResult<Result, Props>;
}

// The full public runner for one call: the merged kit list (Q threaded via AllKits[0]) plus the
// caller's extra methods, intersected with the Q render methods. Mirrors RunnerResult, but with
// a per-call Q that a fixed RunnerFactory `BaseKits` cannot carry — the sole reason this variant
// isn't a plain RunnerFactory const like createReactTestRunner.
type ReactQueriesRunner<
  KitsClasses extends TestKitClasses,
  ExtraMethods extends object,
  Q extends Queries,
> = AppRunnerWithExtraMethods<[ReactTestKitWithQueriesOf<Q>, ...KitsClasses], ExtraMethods> &
  ReactRenderMethodsQ<Q>;

/**
 * The custom-queries counterpart to RunnerFactory: a two-overload factory type that bans
 * explicit `undefined` for extraMethods (skip it with `{}`) exactly as RunnerFactory does, and
 * additionally threads a per-call Q inferred from `customQueries`. Kept as one named type so the
 * overload/ban complexity lives in a single place, and createReactTestRunnerWithQueries can be a
 * thin const — structurally parallel to createReactTestRunner.
 */
type ReactQueriesRunnerFactory = {
  // Kits only: Q defaults, extra methods empty, no getProviders/customQueries reachable.
  <KitsClasses extends TestKitClasses>(
    kits: KitsClasses,
  ): ReactQueriesRunner<KitsClasses, Record<never, never>, typeof defaultQueries>;
  // extraMethods REQUIRED (skip with `{}`); Q inferred from customQueries, defaulting when omitted.
  <
    KitsClasses extends TestKitClasses,
    ExtraMethods extends object,
    Q extends Queries = typeof defaultQueries,
  >(
    kits: KitsClasses,
    extraMethods: ExtraMethods & ThisType<ReactQueriesRunner<KitsClasses, ExtraMethods, Q>>,
    getProviders?: GetProviders & ThisType<ReactQueriesRunner<KitsClasses, ExtraMethods, Q>>,
    customQueries?: Q,
  ): ReactQueriesRunner<KitsClasses, ExtraMethods, Q>;
};

/**
 * Like createReactTestRunner, but accepts custom RTL queries (Q) and auto-prepends
 * ReactTestKitWithQueries<Q>. Use when you need query methods beyond the default set.
 *
 * @param kits - TestKit class array (ReactTestKitWithQueries is auto-prepended).
 * @param extraMethods - Consumer methods (void = chainable, non-void = returns value).
 *   Required whenever getProviders/customQueries follow — pass `{}` to skip it.
 * @param getProviders - Optional extra provider factory (no arg; accesses runner via this).
 * @param customQueries - Custom RTL query object; render/renderHook then type to Q.
 *
 * Authored as a const over ReactQueriesRunnerFactory (loose param types, since contextual typing
 * doesn't flow from an overloaded type into an arrow's params); the runtime render behavior is
 * shared with createReactTestRunner via createReactRenderMethods.
 */
export const createReactTestRunnerWithQueries: ReactQueriesRunnerFactory = (
  kits: TestKitClasses,
  extraMethods?: ExtraMethodsShape,
  getProviders?: GetProviders,
  customQueries?: Queries,
) => {
  const methods = createReactRenderMethods({
    seedKitName: "ReactTestKitWithQueries",
    getProviders,
    extraRenderOptions: customQueries ? { queries: customQueries } : {},
  });
  const merged = { ...methods, ...(extraMethods ?? {}) } as ExtraMethodsShape;
  return createBaseTestRunner([ReactTestKitWithQueries, ...kits], merged) as never;
};
