import { TestKit } from '@honeybook/hive';
import type { Constructor } from 'type-fest';
import { createBaseTestRunner } from '../src/createBaseTestRunner';
import type { AppRunnerWithExtraMethods, RunnerFactory } from '../src/types';

// --- Test kit ---
class UserKit extends TestKit {
  result: { userId: string } = { userId: 'default' };
  get name() { return 'UserKit'; }

  withUserId(id: string): void {
    this.result = { userId: id };
  }
  defaultCallback = () => this.withUserId('default');
}

// --- Pattern A: wrapping factory with merged extra methods ---
let renderCallCount = 0;

type UserKitClasses = readonly [typeof UserKit];

// Fully generic kits parameter so the function satisfies RunnerFactory<{ render(): void }>
function createReactLikeRunner<
  KitsClasses extends ReadonlyArray<Constructor<TestKit>>,
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>
>(
  kits: KitsClasses,
  callerExtraMethods?: ExtraMethods,
): AppRunnerWithExtraMethods<[...KitsClasses], { render(): void } & ExtraMethods> {
  type MergedMethods = { render(): void } & ExtraMethods;

  const builtIn: { render(): void } & ThisType<AppRunnerWithExtraMethods<[...KitsClasses], MergedMethods>> = {
    render() {
      renderCallCount++;
      // render() calls run() — delegates to the runner (synchronous fire-and-forget)
      this.run();
    },
  };

  const merged = { ...builtIn, ...(callerExtraMethods ?? {}) } as MergedMethods &
    ThisType<AppRunnerWithExtraMethods<[...KitsClasses], MergedMethods>>;

  return createBaseTestRunner(kits as unknown as [...KitsClasses], merged) as unknown as AppRunnerWithExtraMethods<
    [...KitsClasses],
    MergedMethods
  >;
}

const _factoryTypeCheck: RunnerFactory<{ render(): void }> = createReactLikeRunner;

describe('createBaseTestRunner — react-like wrapping factory (Pattern A)', () => {
  beforeEach(() => {
    renderCallCount = 0;
  });

  it('render() calls run() and returns the runner', async () => {
    const runner = createReactLikeRunner([UserKit]);
    runner.withUserId('test-user');

    // render() should trigger run internally
    runner.render();
    expect(renderCallCount).toBe(1);

    // result is typed correctly after awaiting run
    const r = await runner.run();
    const userId: string = r.userId;
    expect(userId).toBe('test-user');
  });

  it('this.result is accessible inside caller extra method via ThisType<>', async () => {
    let capturedUserId: string | undefined;

    const runner = createReactLikeRunner([UserKit], {
      checkUser(this: AppRunnerWithExtraMethods<[...UserKitClasses], { render(): void; checkUser(): void }>) {
        // `this.result` must type-check — proves ThisType<> covers extra methods
        capturedUserId = this.result.userId;
      },
    });

    runner.withUserId('captured-user');
    await runner.run();
    runner.checkUser();

    expect(capturedUserId).toBe('captured-user');
  });

  it('non-void extra method returns its actual value (not the runner)', () => {
    const runner = createReactLikeRunner([UserKit], {
      getValue(): string {
        return 'hello';
      },
    });
    const v = runner.getValue();
    expect(v).toBe('hello');
  });

  it('void extra method still chains (returns runner)', () => {
    const runner = createReactLikeRunner([UserKit], {
      setFlag(): void {
        // void return
      },
    });
    const returned = runner.setFlag().withUserId('chain-test');
    expect(returned).toBe(runner);
  });
});
