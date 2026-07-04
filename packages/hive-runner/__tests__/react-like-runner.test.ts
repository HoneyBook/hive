import { TestKit, mergeTestKits } from "@honeybook/hive";
import type { TestKitClasses } from "@honeybook/hive";
import { createBaseTestRunner } from "../src/createBaseTestRunner";
import type {
  AppRunnerWithExtraMethods,
  ExtraMethodsShape,
  NoExecuteFn,
  RunnerFactory,
} from "../src/types";

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

// --- Pattern A: a react-like runner authored against the RunnerFactory contract ---
let renderCallCount = 0;

type UserKitClasses = readonly [typeof UserKit];

// render is a kit-INDEPENDENT base method (RunnerFactory's 3rd type arg), NOT stuffed into
// ExtraMethods — the shape that lets a react-like runner author against a FIXED RunnerFactory
// instantiation rather than a bespoke generic function. (createReactTestRunner does the same,
// with render(): this['result'].)
interface ReactLikeBaseMethods {
  render(): void;
}

// No base kits of its own (BaseKits = []) — still goes through mergeTestKits, same as any
// real RunnerFactory implementation. Authored via a const annotation with loose param types:
// contextual typing does not flow from an overloaded type into an arrow's params, and the body
// casts through into createBaseTestRunner anyway.
const createReactLikeRunner: RunnerFactory<readonly [], NoExecuteFn, ReactLikeBaseMethods> = (
  kits: TestKitClasses,
  callerExtraMethods?: ExtraMethodsShape,
) => {
  const mergedKits = mergeTestKits([] as const, kits);

  const builtIn: ReactLikeBaseMethods & ThisType<{ run(): Promise<unknown> }> = {
    render() {
      renderCallCount++;
      // render() calls run() — delegates to the runner (synchronous fire-and-forget)
      this.run();
    },
  };

  const merged = { ...builtIn, ...(callerExtraMethods ?? {}) } as ExtraMethodsShape;

  return createBaseTestRunner(mergedKits, merged) as never;
};

describe("createBaseTestRunner — react-like runner authored via RunnerFactory (Pattern A)", () => {
  beforeEach(() => {
    renderCallCount = 0;
  });

  it("render() calls run() and the runner exposes kit results", async () => {
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
      checkUser(this: AppRunnerWithExtraMethods<[...UserKitClasses], { checkUser(): void }>) {
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

  it("passing undefined for extraMethods is a compile error (the ban), not a silent any-widening", () => {
    // @ts-expect-error — explicit undefined matches neither overload; pass {} to skip extraMethods.
    createReactLikeRunner([UserKit], undefined);
    // The supported way to skip extra methods while still constructing the runner:
    const runner = createReactLikeRunner([UserKit], {});
    // @ts-expect-error — runner must not have degraded to `any`; this method does not exist.
    const bogus = runner.withNope;
    expect(bogus).toBeUndefined();
    expect(renderCallCount).toBe(0);
  });
});
