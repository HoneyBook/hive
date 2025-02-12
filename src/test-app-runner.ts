import { TestKit } from './test-kit';
import { buildTestKitRecordFromArray } from './utils';
import {
    TestKitArrayToRecord,
    AppRunnerWithChainableTestKitsMethods,
    CombinedTestKitsResult
} from './types';

function isBuilderMethod(method: string): method is `with${string}` {
    return method.startsWith('with');
}

/** Combines test kits that describe a specific app for tests. */
export abstract class TestAppRunner<TestKits extends Array<TestKit>> {
    protected testKits: TestKits;
    protected testKitsMap: TestKitArrayToRecord<TestKits>;

    get result(): CombinedTestKitsResult<TestKits> {
        return Object.assign(
            {},
            ...this.testKits.map(testKit => testKit.result)
        );
    }

    constructor({
        testKits,
    }: {
        testKits: TestKits;
    }) {
        this.testKits = testKits;
        this.testKitsMap = buildTestKitRecordFromArray<TestKits>(this.testKits);

        // Dynamically bind testKit methods to the runner
        testKits.forEach(testKit => {
            this.loadEachTestKitWithItsDepTestKits(testKit);
            this.initTestKit(testKit);
            this.applyTestKitMethodsOnAppRunner(testKit);
        });
    }


    private applyTestKitMethodsOnAppRunner(testKit: TestKit) {
        Object.getOwnPropertyNames(Object.getPrototypeOf(testKit)).forEach(
            methodName => {
                if (!isBuilderMethod(methodName)) {
                    return;
                }

                const method = testKit[methodName];
                if (typeof method != "function") {
                    return;
                }

                (this as any)[methodName] = (...props: any[]) => {
                    testKit.initDependentTestKitsIfNeeded();

                    // If the first prop is a function, call it with the current accommodated result.
                    if (typeof props[0] == 'function') {
                        props[0] = props[0](this.result);
                    }

                    method.apply(testKit, props);

                    testKit.markAsLoaded();

                    return this;
                };
            }
        );
    }

    private loadEachTestKitWithItsDepTestKits(testKit: TestKit) {
        testKit.setDependentTestKits(
            testKit.dependentTestKitsClasses.map(
                dependentTestKitClass =>
                    this.testKitsMap[dependentTestKitClass.name]
            )
        );
    }

    initAllTestKitsWithDefaults() {
        this.testKits.forEach(testKit => {
            if (testKit.isLoaded || !testKit.defaultCallback) {
                return;
            }

            testKit.initDependentTestKitsIfNeeded();
            testKit.defaultCallback();
            testKit.markAsLoaded();
        });
    }

    abstract run(): CombinedTestKitsResult<TestKits>;

    protected initTestKit(testKit: TestKit) {
        testKit.init();
    }
}

export const createAppRunner = <
    TestKits extends Array<TestKit>,
    AppRunner extends TestAppRunner<TestKits>
>({
    appRunnerClass
}: {
    appRunnerClass: new () => AppRunner;
}) =>
    new appRunnerClass() as AppRunnerWithChainableTestKitsMethods<
        TestKits,
        AppRunner
    >;
