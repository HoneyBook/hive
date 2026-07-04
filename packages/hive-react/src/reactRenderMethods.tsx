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

/**
 * Describes the fields renderHook() seeds onto the runner's result — the SAME merged object
 * render()/renderComponent() already return (`.ui`, kit results) — not a bespoke object of its
 * own. RTL's own native renderHook nests its result under a `result` key
 * (`{ result: { current } }`); hive-react isn't bound to that convention since this is
 * homegrown, and nesting would collide with the runner's OWN `.result`: a caller naming the
 * return value `result` — the obvious name, and the one honeybook-react's real call sites
 * actually used — would end up writing `result.result.current`, which reads badly and was
 * mistaken for a typo more than once in practice. Intersected onto `this['result']` at the
 * public renderHook() signature (see createReactTestRunner.test-runner.tsx and the
 * WithQueries variant) — same `this['result']` pattern render()/renderComponent() use, just
 * widened with these per-call fields.
 *
 * Note on liveness: `runner.result` (from @honeybook/hive's TestAppRunner) is a GETTER that
 * recomputes a fresh merge of every kit's `.result` on every access — it is not a persistent
 * object. So `.rerender()`/`.unmount()` are stable across any snapshot (real closures, callable
 * from an old reference), but `.current` is only live if re-read via `runner.result.current` —
 * the exact same discipline already required for any kit-seeded field (e.g. re-reading
 * `runner.result.userId` after `runner.withUserId(...)`, not a value captured before it).
 */
export interface RenderHookResult<Result, Props> {
  /** Only live via a fresh `runner.result.current` read — see this type's own doc comment. */
  current: Result;
  /** Re-renders the hook. Pass new props to thread them into the next `hook(props)` call. */
  rerender: (props?: Props) => void;
  unmount: () => void;
}

interface ReactHookSeedKit {
  seedRenderResult(rtlResult: RenderResult): void;
  seedHookValue(current: unknown): void;
  seedHookActions(rerender: (props?: unknown) => void, unmount: () => void): void;
}

// The minimal runner surface the render methods touch at runtime. The PUBLIC render-method
// types (render(): this['result'], custom-query options, etc.) live on each variant's own
// interface — this internal `this` only needs enough to drive RTL and seed the kit result.
interface RenderRunnerThis {
  run(): Promise<unknown>;
  result: { ui: RenderResult };
  testKits: TestKit[];
  testKitsMap: Record<string, ReactHookSeedKit>;
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

// --- Between-tests auto-teardown -------------------------------------------------------------
// Each runner registers its own scoped cleanup here; one module-level afterEach drains them all
// between tests. hive-react renders through its OWN @testing-library/react instance, so this
// guarantees runner-mounted content is torn down regardless of the consumer's RTL instance and
// without relying on RTL's own auto-cleanup firing. The runner is the ONLY mount/unmount surface
// — there is deliberately no exported global cleanup. Opt out via HIVE_REACT_SKIP_AUTO_CLEANUP,
// mirroring RTL's RTL_SKIP_AUTO_CLEANUP.
const activeRunnerCleanups = new Set<() => void>();

// Reach the test-runner globals without a hard dependency on jest/node ambient types (the src
// build doesn't include them). Optional-typed so it works whether or not they're declared.
const testGlobals = globalThis as typeof globalThis & {
  afterEach?: (fn: () => void) => void;
  process?: { env?: Record<string, string | undefined> };
};

if (
  typeof testGlobals.afterEach === "function" &&
  !testGlobals.process?.env?.HIVE_REACT_SKIP_AUTO_CLEANUP
) {
  testGlobals.afterEach(() => {
    activeRunnerCleanups.forEach((cleanup) => cleanup());
    activeRunnerCleanups.clear();
  });
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

  // Every RTL result this runner mounts, tracked so cleanup() (and the module-level auto-teardown
  // afterEach) can unmount and detach exactly this runner's renders — the runner owns its own
  // mount/unmount lifecycle.
  const ownResults: RenderResult[] = [];

  function cleanupOwn(): void {
    ownResults.forEach((result) => {
      result.unmount();
      const { container } = result;
      container.parentNode?.removeChild(container);
    });
    ownResults.length = 0;
    activeRunnerCleanups.delete(cleanupOwn);
  }

  function prepare(this: RenderRunnerThis): Wrapper {
    this.run();
    beforeRenderCallbacks.forEach((cb) => cb(this.result));
    return getProviderStack(this.testKits, getProviders?.bind(this));
  }

  function seed(this: RenderRunnerThis, rtlResult: RenderResult): void {
    this.testKitsMap[seedKitName].seedRenderResult(rtlResult);
    ownResults.push(rtlResult);
    // (Re-)register for between-tests auto-teardown; the Set dedups, and a render after a manual
    // cleanup() re-arms it.
    activeRunnerCleanups.add(cleanupOwn);
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
    // uses internally: a hidden component calls the hook and reports its return value out,
    // rendered via the SAME rtlRender + `wrapper` option render()/renderComponent() already use
    // above — not manual provider-JSX nesting. This means renderHook() works identically on
    // every RTL version render()/renderComponent() already support (>=11), with no
    // version-gated dependency anywhere.
    renderHook<Props>(
      this: RenderRunnerThis,
      hook: (props: Props) => unknown,
      options?: RenderHookOptions<Props>,
    ) {
      const wrapper = prepare.call(this);
      // Seeds onto the SEED KIT instance (like seedRenderResult() does for `.ui`), not a
      // snapshot of `this.result` — this.result is a getter that recomputes fresh on every
      // access (@honeybook/hive's TestAppRunner), so mutating a snapshot would be discarded
      // the moment anything re-reads it. `current` is re-seeded on every render, since it's
      // the hook's latest return value each time; the kit is the one persistent place for it.
      const kit = this.testKitsMap[seedKitName];
      let latestProps = options?.initialProps as Props;

      function HookConsumer() {
        kit.seedHookValue(hook(latestProps));
        return null;
      }

      const ui = rtlRender(<HookConsumer />, {
        wrapper,
        ...extraRenderOptions,
        ...options,
      } as RenderOptions);
      seed.call(this, ui);

      kit.seedHookActions(
        // Cast: seedHookActions takes a loose (props?: unknown) => void since the kit doesn't
        // know the caller's Props generic; the public renderHook() signature re-narrows it via
        // `this['result'] & RenderHookResult<Result, Props>` (same loose-internals-plus-cast
        // pattern used throughout this file, e.g. extraMethods as ExtraMethodsShape elsewhere).
        ((props?: Props) => {
          if (props !== undefined) {
            latestProps = props;
          }
          ui.rerender(<HookConsumer />);
        }) as (props?: unknown) => void,
        () => ui.unmount(),
      );

      return this.result;
    },
    // Declared void — createBaseTestRunner's wrapper upgrades a void return to `this` for
    // chaining, matching kit with* methods.
    withBeforeRender(callback: (result: unknown) => void): void {
      beforeRenderCallbacks.push(callback);
    },
    // Unmounts and detaches every render this runner produced, then drops it from the auto-
    // teardown registry. Scoped to THIS runner (not a global) — the sole consumer-facing unmount
    // surface. Void return is upgraded to `this` by createBaseTestRunner for chaining.
    cleanup(): void {
      cleanupOwn();
    },
  };
}
