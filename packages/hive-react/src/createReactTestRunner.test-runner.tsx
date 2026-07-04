import React from "react";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type {
  ExtraMethodsShape,
  NoExecuteFn,
  RunnerFactory,
  TestKitClasses,
} from "@honeybook/hive-runner";
import type { RenderOptions } from "@testing-library/react";
import { createReactRenderMethods } from "./reactRenderMethods";
import type { GetProviders, RenderHookOptions, RenderHookResult } from "./reactRenderMethods";
import { ReactTestKit } from "./ReactTestKit.test-kit";

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
 * `CombinedTestKitsResult<AllKits>`. Polymorphic `this` re-resolves to the full merged
 * runner at every call site, so `this['result']` IS the merged result of every kit (base +
 * caller) — with no generic AllKits parameter. That is what lets createReactTestRunner be a
 * FIXED `RunnerFactory<...>` instantiation (below) instead of a bespoke generic function.
 *
 * `extends { result: unknown }` exists only so `this['result']` is syntactically valid at the
 * declaration; `unknown & CombinedTestKitsResult<...>` collapses to the real merged result at
 * the intersection use-site (see RunnerResult in @honeybook/hive-runner).
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

/**
 * createReactTestRunner — React platform runner factory.
 *
 * Always prepends ReactTestKit (via REACT_BASE_KITS). ReactTestKit.result.ui (RenderResult) is
 * seeded by render/renderComponent/renderHook, so runner.result includes both kit results and
 * the RTL render result under `.ui`. render() etc. call this.run() without awaiting
 * (fire-and-forget — React handles async state; tests use waitFor/findBy). Provider stack:
 * first kit in the array = outermost provider. `component` is optional on
 * render()/renderComponent() — omit it when the content under test is mounted by a kit's own
 * Provider(); the provider stack is then rendered alone via an empty fragment.
 *
 * A fixed `RunnerFactory` instantiation: ReactBaseKits (auto-prepended), NoExecuteFn (no
 * execute hook), ReactRenderMethods (the this['result']-based render methods), GetProviders
 * (the optional trailing PlatformArg). The two-overload ban on extraMethods (skip it with `{}`,
 * never `undefined`) is inherited from RunnerFactory. The runtime render behavior is shared
 * with createReactTestRunnerWithQueries via createReactRenderMethods.
 */
export const createReactTestRunner: RunnerFactory<
  ReactBaseKits,
  NoExecuteFn,
  ReactRenderMethods,
  GetProviders
> = (kits: TestKitClasses, extraMethods?: ExtraMethodsShape, getProviders?: GetProviders) => {
  const methods = createReactRenderMethods({ seedKitName: "ReactTestKit", getProviders });
  const merged = { ...methods, ...(extraMethods ?? {}) } as ExtraMethodsShape;
  return createBaseTestRunner([ReactTestKit, ...kits], merged) as never;
};
