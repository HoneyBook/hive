import { TestKit } from "../test-kits/test-kit";
import { isFunction } from "lodash-es";
import {
  buildTestKitRecordFromArray,
  collectImplicitDependenciesDeep,
} from "../test-kits/test-kit.utils";
import { TestKitArrayToRecord, TestKitClasses } from "../test-kits/test-kits.types";
import { CombinedTestKitsResultFromClasses, TestKitsInstances } from "./app-runner.types";
import { AppRunnerWithChainableTestKitsMethods } from "./app-runner.types";

/** Combines test kits that describe a specific app for tests. */
export abstract class TestAppRunner<
  KitsClasses extends TestKitClasses,
  TestKits extends TestKitsInstances<KitsClasses> = TestKitsInstances<KitsClasses>,
> {
  protected testKits: TestKits;
  protected testKitsMap: TestKitArrayToRecord<TestKits>;

  get result(): CombinedTestKitsResultFromClasses<KitsClasses> {
    return Object.assign(
      {},
      ...this.testKits.map((testKit) => testKit.result),
    ) as CombinedTestKitsResultFromClasses<KitsClasses>;
  }

  constructor({ testKitsClasses }: { testKitsClasses: KitsClasses }) {
    const testKits = testKitsClasses.map((testKitClass) => new testKitClass());
    const testKitsMap = buildTestKitRecordFromArray<TestKits>(testKits);
    const impliedTestKitsMap = collectImplicitDependenciesDeep(testKitsMap);

    this.testKits = [...testKits, ...Object.values(impliedTestKitsMap)] as TestKits;

    this.testKitsMap = {
      ...testKitsMap,
      ...impliedTestKitsMap,
    };
  }

  setup() {
    // Dynamically bind testKit methods to the runner
    this.testKits.forEach((testKit) => {
      this.loadEachTestKitWithItsDepTestKits(testKit);
      this.applyTestKitMethodsOnAppRunner(testKit);
    });
  }

  private applyTestKitMethodsOnAppRunner(testKit: TestKit) {
    this.getAllMethodNames(testKit).forEach((methodName) => {
      if (!methodName.startsWith("with")) {
        return;
      }
      const method = (testKit as unknown as Record<string, unknown>)[methodName];
      if (!isFunction(method)) {
        return;
      }

      (this as any)[methodName] = (...props: any[]) => {
        testKit.initDependentTestKitsIfNeeded();

        // If the first prop is a function, call it with the current accommodated result.
        if (isFunction(props[0])) {
          props[0] = props[0](this.result);
        }

        testKit.callWith(method as (...args: any[]) => any, props);

        return this;
      };
    });
  }

  /**
   * Gets all method names from an object including inherited methods.
   * Walks up the prototype chain to collect methods from parent classes.
   */
  private getAllMethodNames(obj: object): string[] {
    const methods = new Set<string>();
    let currentProto = Object.getPrototypeOf(obj);

    // Walk up the prototype chain until we hit Object.prototype
    while (currentProto && currentProto !== Object.prototype) {
      Object.getOwnPropertyNames(currentProto).forEach((name) => methods.add(name));
      currentProto = Object.getPrototypeOf(currentProto);
    }

    return Array.from(methods);
  }

  private loadEachTestKitWithItsDepTestKits(testKit: TestKit) {
    testKit.setDependentTestKits(
      testKit.dependentTestKitClasses.map(
        (dependentTestKitClass: new () => TestKit) =>
          (this.testKitsMap as Record<string, TestKit>)[dependentTestKitClass.name],
      ),
    );
  }

  initAllTestKitsWithDefaults() {
    this.testKits.forEach((testKit) => {
      if (testKit.wasInit || !testKit.defaultCallback) {
        return;
      }

      testKit.initDependentTestKitsIfNeeded();
      testKit.defaultInit();
    });
  }

  abstract run():
    | CombinedTestKitsResultFromClasses<KitsClasses>
    | Promise<CombinedTestKitsResultFromClasses<KitsClasses>>;
}

export const createAppRunner = <
  KitsClasses extends TestKitClasses,
  TestKits extends Array<InstanceType<KitsClasses[number]>>,
  AppRunner extends TestAppRunner<KitsClasses, TestKits>,
>({
  appRunnerClass,
}: {
  appRunnerClass: new () => AppRunner;
}) => {
  const appRunner = new appRunnerClass();

  appRunner.setup();

  return appRunner as AppRunnerWithChainableTestKitsMethods<KitsClasses, AppRunner>;
};
