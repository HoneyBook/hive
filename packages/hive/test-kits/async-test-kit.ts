import { TestKit } from './test-kit';

/**
 * Base class for test kits that need async seeding.
 *
 * - `with*` methods stay sync + chainable, recording intent into instance fields.
 * - `build()` is overridden by concrete kits; does async work; reads
 *   dependencies via `await dep.value`.
 * - `value` (getter) returns the memoized `resolve()` promise — triggering
 *   `build()` lazily on first access.
 * - `resolve()` memoizes: one `build()` per kit instance per arm cycle.
 * - `reset()` clears the memo so a kit can be re-armed between `it()` calls.
 *
 * result: hive reads this post-flush (sync settled value). Set by `resolve()`.
 */
export abstract class AsyncTestKit<
  TResult,
  Dependencies extends Array<TestKit> = any[],
> extends TestKit<Dependencies> {
  /**
   * Sync settled value — hive + tests read this post-flush (post-resolve).
   * Typed as `TResult` (not `TResult | undefined`) so CombinedTestKitsResult —
   * `UnionToIntersection<...['result']>` — doesn't collapse to `never` on the
   * `undefined` member. It is genuinely undefined only before resolve(), which
   * no consumer reads (the runner flushes kits before exposing `result`).
   */
  result: TResult = {} as TResult;

  /** Memoized promise — set once per arm cycle by resolve(). */
  private _promise: Promise<TResult> | undefined = undefined;

  /**
   * The async result dependents await.
   * This getter triggers resolve() lazily so a dep awaiting `dep.value`
   * before the parent run() Promise.all reaches it still fires build().
   */
  get value(): Promise<TResult> {
    return this.resolve();
  }

  /**
   * Memoized: calls build() once per arm cycle, settles result.
   * Subsequent calls return the same promise.
   */
  resolve(): Promise<TResult> {
    if (!this._promise) {
      this._promise = this.build().then((r) => {
        this.result = r;
        return r;
      });
    }
    return this._promise;
  }

  /**
   * Concrete kits override this to perform async work.
   * Read dependency data via `await dep.value` (NOT dep.result, which may
   * not yet be settled).
   */
  protected abstract build(): Promise<TResult>;

  /**
   * Clears the memoized promise and result so the kit can be re-armed
   * between it() calls (construct at describe scope, drive per it()).
   */
  protected reset(): void {
    this._promise = undefined;
    this.result = {} as TResult;
    this._wasInit = false;
  }
}
