import { TestAppRunner, createAppRunner, AsyncTestKit } from "@honeybook/hive";
import type {
  CombinedTestKitsResultFromClasses,
  TestKitsInstances,
  TestKitArrayToRecord,
  TestKitClasses,
} from "@honeybook/hive";
import type { AppRunnerWithExtraMethods } from "./types";

/**
 * Platform-agnostic base runner engine — React-stripped port of createHbTestAppRunner.
 *
 * It does NOT force any base kits. Each named runner (createServiceTestRunner,
 * createTemporalTestRunner, …) declares its OWN base kit list and passes the full
 * set here — mirroring hb-react's per-runner base kits (mxTestAppRunner /
 * cxTestAppRunner). Shared infra kits are opt-in per runner, so no test is forced to
 * pull in kits it doesn't use.
 *
 * `execute` is optional:
 * - Omitted → kit-only escape hatch: materializes kits, no app import.
 * - Provided → called after kit flush; returns a handle merged onto the runner.
 *
 * `run()` sequence:
 *   1. initAllTestKitsWithDefaults() (hive, sync)
 *   2. async kit flush: awaits every AsyncTestKit's resolve() in parallel
 *      (promise-chain self-orders deps — each build() awaits its deps' value)
 *   3. await execute?.call(this) → Object.assign(this, handle)
 *   4. return this
 *
 * `run()` is memoized — repeated calls return the same promise (one flush per arm cycle).
 *
 * A test calling bare `createBaseTestRunner` is the reviewable red flag ("why
 * isn't this a real-environment test?") — the named wrappers are the real work.
 */

type ExecuteFn = (this: BaseTestRunner) => object | Promise<object>;

// The class stays GENERIC over its kit classes — like hb-react's HbTestAppRunner —
// so AppRunnerWithExtraMethods can re-narrow `result` / `testKitsMap` to the actual
// kits instead of collapsing to `unknown`.
export class BaseTestRunner<
  KitsClasses extends TestKitClasses = TestKitClasses,
  TestKits extends TestKitsInstances<KitsClasses> = TestKitsInstances<KitsClasses>,
> extends TestAppRunner<KitsClasses, TestKits> {
  private _execute?: ExecuteFn;
  private _runPromise: Promise<CombinedTestKitsResultFromClasses<KitsClasses>> | null = null;

  run(): Promise<CombinedTestKitsResultFromClasses<KitsClasses>> {
    if (!this._runPromise) {
      this._runPromise = this._doRun();
    }
    return this._runPromise;
  }

  private async _doRun(): Promise<CombinedTestKitsResultFromClasses<KitsClasses>> {
    // 1. Init kits with defaults (sync, hive)
    this.initAllTestKitsWithDefaults();

    // 2. Async kit flush — self-ordering via promise chain
    await Promise.all(
      this.testKits.map((k) => (k instanceof AsyncTestKit ? k.resolve() : Promise.resolve())),
    );

    // 3. execute hook (e.g. supertest agent setup), this-bound like extraMethods
    if (this._execute) {
      const handle = await this._execute.call(this);
      if (handle) {
        Object.assign(this, handle);
      }
    }

    return this.result;
  }

  _setExecute(execute: ExecuteFn): void {
    this._execute = execute;
  }
}

/**
 * Factory: creates a configured BaseTestRunner subclass over exactly the kit classes
 * passed (no implicit base kits — named runners own their base list).
 *
 * @param kits - The full kit class list for this runner.
 * @param extraMethods - Optional extra methods bound to the runner (same pattern as hive).
 * @param execute - Optional async hook; return value is merged onto the runner.
 *   Omit to get the kit-only escape hatch (never imports app).
 */
export function createBaseTestRunner<
  KitsClasses extends TestKitClasses = readonly [],
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>,
  Handle extends object = Record<never, never>,
>(
  kits: KitsClasses,
  // ThisType binds `this` inside each extra method to the full runner (chainable
  // with* methods + the other extra methods + a typed `result`) plus `testKitsMap`
  // for direct kit access — mirroring hb-react's createHbTestAppRunner.
  extraMethods?: ExtraMethods &
    ThisType<
      AppRunnerWithExtraMethods<KitsClasses, ExtraMethods> & {
        testKitsMap: TestKitArrayToRecord<TestKitsInstances<KitsClasses>>;
      }
    >,
  // execute is for non-React runners. ThisType binds its `this` to the same
  // full runner, so the hook reads kit results — e.g. an AuthTestKit's `authedUser`
  // — off the now-properly-typed `this.result` with no casts.
  execute?: (() => Handle | Promise<Handle>) &
    ThisType<AppRunnerWithExtraMethods<KitsClasses, ExtraMethods>>,
): AppRunnerWithExtraMethods<KitsClasses, ExtraMethods, Handle> {
  // Dedup by class so a kit listed twice (or pulled in as another's dependency)
  // isn't instantiated twice.
  const allKitsClasses = [...new Set(kits)] as unknown as TestKitClasses;

  class ExtendedAppRunner extends BaseTestRunner {
    constructor() {
      super({ testKitsClasses: allKitsClasses });

      // Apply extra methods (same .call(this) binding pattern as hive factory)
      if (extraMethods) {
        const target = this as Record<string, unknown>;
        Object.keys(extraMethods).forEach((k) => {
          const method = extraMethods[k];
          target[k] = (...args: unknown[]) => {
            const result = method.call(this, ...args);
            // void methods return undefined — chain; non-void methods return their value
            return result === undefined ? this : result;
          };
        });
      }

      if (execute) {
        this._setExecute(execute as ExecuteFn);
      }
    }
  }

  return createAppRunner({
    appRunnerClass: ExtendedAppRunner,
  }) as unknown as AppRunnerWithExtraMethods<KitsClasses, ExtraMethods, Handle>;
}
