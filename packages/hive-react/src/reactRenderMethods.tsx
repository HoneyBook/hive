import React from "react";
import type { TestKit } from "@honeybook/hive";
import { render as rtlRender } from "@testing-library/react";
import type { Queries, RenderOptions, RenderResult } from "@testing-library/react";
import { generateProviderStack } from "./generateProviderStack";

type Wrapper = NonNullable<RenderOptions["wrapper"]>;

// GetProviders: no arg, returns a Wrapper. Bound to the runner `this` at call time.
export type GetProviders = () => Wrapper;

/**
 * Deliberately NOT imported from `@testing-library/react` (unlike RenderOptions/RenderResult,
 * which render()/renderComponent() do use directly) — RTL only gained a native `renderHook`,
 * and these two types describing it, in v13. A consumer pinned to RTL <13 (e.g. honeybook-react
 * on RTL 11 / React 17) would fail to resolve these names against their own installed RTL
 * types, since hive-react's public .d.ts type-checks against the CONSUMER's installed RTL, not
 * hive-react's own. renderHook() below is homegrown specifically so it has zero dependency on
 * RTL's own renderHook (native or otherwise) — these types describe that homegrown result.
 */
export interface RenderHookOptions<Props> {
  initialProps?: Props;
  wrapper?: Wrapper;
}

export interface RenderHookResult<Result, Props> {
  /** Stable reference; only `.current` changes across renders. */
  result: { current: Result };
  /** Re-renders the hook. Pass new props to thread them into the next `hook(props)` call. */
  rerender: (props?: Props) => void;
  unmount: () => void;
}

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
    // Homegrown — NOT a thin wrapper over RTL's own renderHook (native, RTL >=13 only) or the
    // separate @testing-library/react-hooks package. Same core technique RTL's native renderHook
    // uses internally: a hidden component calls the hook and reports its return value out
    // through a stable mutable box, rendered via the SAME rtlRender + `wrapper` option
    // render()/renderComponent() already use above — not manual provider-JSX nesting. This
    // means renderHook() works identically on every RTL version render()/renderComponent()
    // already support (>=11), with no version-gated dependency anywhere.
    renderHook<Props>(
      this: RenderRunnerThis,
      hook: (props: Props) => unknown,
      options?: RenderHookOptions<Props>,
    ) {
      const wrapper = prepare.call(this);
      const resultBox: { current: unknown } = { current: undefined };
      let latestProps = options?.initialProps as Props;

      function HookConsumer() {
        resultBox.current = hook(latestProps);
        return null;
      }

      const ui = rtlRender(<HookConsumer />, {
        wrapper,
        ...extraRenderOptions,
        ...options,
      } as RenderOptions);
      seed.call(this, ui);

      return {
        result: resultBox,
        rerender: (props?: Props) => {
          if (props !== undefined) {
            latestProps = props;
          }
          ui.rerender(<HookConsumer />);
        },
        unmount: () => ui.unmount(),
      };
    },
    // Declared void — createBaseTestRunner's wrapper upgrades a void return to `this` for
    // chaining, matching kit with* methods.
    withBeforeRender(callback: (result: unknown) => void): void {
      beforeRenderCallbacks.push(callback);
    },
  };
}
