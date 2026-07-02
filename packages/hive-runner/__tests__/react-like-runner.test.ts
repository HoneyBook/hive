import { TestKit, mergeTestKits } from "@honeybook/hive";
import type { TestKitClasses } from "@honeybook/hive";
import { createBaseTestRunner } from "../src/createBaseTestRunner";
import type { AppRunnerWithExtraMethods, NoExecuteFn, RunnerFactory } from "../src/types";

// --- Test kit ---
class UserKit extends TestKit {
  result: { userId: string } = { userId: "default" };
  get name() {
    return "UserKit";
  }

  withUserId(id: string): void {
    this.result = { userId: id };
  }
  defaultCallback = () => this.withUserId("default");
}

// --- Pattern A: wrapping factory with merged extra methods ---
let renderCallCount = 0;

type UserKitClasses = readonly [typeof UserKit];

// No base kits of its own (BaseKits = []) — still goes through mergeTestKits, same as any
// real RunnerFactory implementation, so it stays compatible with the RunnerFactory contract
// regardless of whether callers pass a plain kits array or an already-merged composite.
//
// No explicit return-type annotation — same as every real named runner (createExpressTestRunner,
// atlas's createServiceTestRunner, ...): let it flow from mergeTestKits + createBaseTestRunner's
// own inference. Hand-writing a return type here would force mergeTestKits's arguments to produce
// an exactly-matching type (right down to whether `[]` infers as the tuple `[]` or as `never[]`),
// which is friction real callers never hit — they never write this annotation either.
function createReactLikeRunner<
  KitsClasses extends TestKitClasses,
  ExtraMethods extends Record<string, (...args: any[]) => unknown> = Record<never, never>,
>(kits: KitsClasses, callerExtraMethods?: ExtraMethods) {
  const mergedKits = mergeTestKits([] as const, kits);
  type AllKitsClasses = typeof mergedKits;
  type MergedMethods = { render(): void } & ExtraMethods;

  const builtIn: { render(): void } & ThisType<
    AppRunnerWithExtraMethods<AllKitsClasses, MergedMethods>
  > = {
    render() {
      renderCallCount++;
      // render() calls run() — delegates to the runner (synchronous fire-and-forget)
      this.run();
    },
  };

  const merged = { ...builtIn, ...(callerExtraMethods ?? {}) } as MergedMethods &
    ThisType<AppRunnerWithExtraMethods<AllKitsClasses, MergedMethods>>;

  return createBaseTestRunner(mergedKits, merged) as unknown as AppRunnerWithExtraMethods<
    AllKitsClasses,
    MergedMethods
  >;
}

const _factoryTypeCheck: RunnerFactory<readonly [], NoExecuteFn, { render(): void }> =
  createReactLikeRunner;

describe("createBaseTestRunner — react-like wrapping factory (Pattern A)", () => {
  beforeEach(() => {
    renderCallCount = 0;
  });

  it("render() calls run() and returns the runner", async () => {
    const runner = createReactLikeRunner([UserKit]);
    runner.withUserId("test-user");

    // render() should trigger run internally
    runner.render();
    expect(renderCallCount).toBe(1);

    // result is typed correctly after awaiting run
    const r = await runner.run();
    const userId: string = r.userId;
    expect(userId).toBe("test-user");
  });

  it("this.result is accessible inside caller extra method via ThisType<>", async () => {
    let capturedUserId: string | undefined;

    const runner = createReactLikeRunner([UserKit], {
      checkUser(
        this: AppRunnerWithExtraMethods<[...UserKitClasses], { render(): void; checkUser(): void }>,
      ) {
        // `this.result` must type-check — proves ThisType<> covers extra methods
        capturedUserId = this.result.userId;
      },
    });

    runner.withUserId("captured-user");
    await runner.run();
    runner.checkUser();

    expect(capturedUserId).toBe("captured-user");
  });

  it("non-void extra method returns its actual value (not the runner)", () => {
    const runner = createReactLikeRunner([UserKit], {
      getValue(): string {
        return "hello";
      },
    });
    const v = runner.getValue();
    expect(v).toBe("hello");
  });

  it("void extra method still chains (returns runner)", () => {
    const runner = createReactLikeRunner([UserKit], {
      setFlag(): void {
        // void return
      },
    });
    const returned = runner.setFlag().withUserId("chain-test");
    expect(returned).toBe(runner);
  });
});
