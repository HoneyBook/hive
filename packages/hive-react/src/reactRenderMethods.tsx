import React from "react";
import type { TestKit } from "@honeybook/hive";
import { render as rtlRender, renderHook as rtlRenderHook } from "@testing-library/react";
import type { Queries, RenderOptions, RenderResult } from "@testing-library/react";
import { generateProviderStack } from "./generateProviderStack";

type Wrapper = NonNullable<RenderOptions["wrapper"]>;

// GetProviders: no arg, returns a Wrapper. Bound to the runner `this` at call time.
export type GetProviders = () => Wrapper;

// The minimal runner surface the render methods touch at runtime. The PUBLIC render-method
// types (render(): this['result'], custom-query options, etc.) live on each variant's own
// interface — this internal `this` only needs enough to drive RTL and seed the kit result.
interface RenderRunnerThis {
  run(): Promise<unknown>;
  result: { ui: RenderResult };
  testKits: TestKit[];
  testKitsMap: Record<string, { seedRenderResult(rtlResult: RenderResult): void }>;
}

function getProviderStack(testKits: TestKit[], extraProvider?: () => Wrapper): Wrapper {
  const kitStack = generateProviderStack(testKits);
  if (!extraProvider) {
    return kitStack;
  }
  // Lazy — extraProvider() is called inside the returned Wrapper, at React render time.
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
 * The render-family runtime shared by both React runner variants (base + custom-queries).
 * The two variants differ only in three values passed here — the kit whose result carries the
 * RTL output, the extra render options (custom `queries`), and nothing else — so the actual
 * render/renderComponent/renderHook/withBeforeRender behavior lives here once.
 *
 * Returns a plain methods object to be merged into the runner via createBaseTestRunner's
 * extraMethods (void methods chain; non-void return their value). Each method's `this` is the
 * live runner; the variant's own render-method interface supplies the public types.
 *
 * @param seedKitName - testKitsMap key of the kit whose `result.ui` receives the RTL result.
 * @param getProviders - optional per-call extra provider factory (wraps INSIDE the kit stack).
 * @param extraRenderOptions - options merged into every RTL render call (e.g. `{ queries }`).
 */
export function createReactRenderMethods(config: {
  seedKitName: string;
  getProviders?: GetProviders;
  extraRenderOptions?: { queries?: Queries };
}) {
  const { seedKitName, getProviders, extraRenderOptions } = config;
  const beforeRenderCallbacks: Array<(result: unknown) => void> = [];

  function prepare(this: RenderRunnerThis): Wrapper {
    this.run();
    beforeRenderCallbacks.forEach((cb) => cb(this.result));
    return getProviderStack(this.testKits, getProviders?.bind(this));
  }

  function seed(this: RenderRunnerThis, rtlResult: RenderResult): void {
    this.testKitsMap[seedKitName].seedRenderResult(rtlResult);
  }

  return {
    render(this: RenderRunnerThis, component?: React.ReactElement, options?: RenderOptions) {
      const wrapper = prepare.call(this);
      // No component means the content under test is mounted by a kit's own Provider() —
      // render the provider stack alone via an empty fragment (the old zero-arg convention).
      const rtlResult = rtlRender(component ?? <></>, {
        wrapper,
        ...extraRenderOptions,
        ...options,
      } as RenderOptions);
      seed.call(this, rtlResult);
      return this.result;
    },
    renderComponent(
      this: RenderRunnerThis,
      component?: React.ReactElement | ((result: unknown) => React.ReactElement),
      options?: RenderOptions,
    ) {
      const wrapper = prepare.call(this);
      const element =
        typeof component === "function" ? component(this.result) : (component ?? <></>);
      const rtlResult = rtlRender(element, {
        wrapper,
        ...extraRenderOptions,
        ...options,
      } as RenderOptions);
      seed.call(this, rtlResult);
      return this.result;
    },
    renderHook(
      this: RenderRunnerThis,
      hook: (props: never) => unknown,
      options?: { wrapper?: Wrapper },
    ) {
      const wrapper = prepare.call(this);
      const rtlResult = rtlRenderHook(hook, { wrapper, ...extraRenderOptions, ...options });
      // renderHook's result is not a RenderResult — seed as-is for reference; cast required.
      seed.call(this, rtlResult as unknown as RenderResult);
      return rtlResult;
    },
    // Declared void — createBaseTestRunner's wrapper upgrades a void return to `this` for
    // chaining, matching kit with* methods.
    withBeforeRender(callback: (result: unknown) => void): void {
      beforeRenderCallbacks.push(callback);
    },
  };
}
