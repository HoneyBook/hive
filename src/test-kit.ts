import { buildTestKitRecordFromArray } from './utils';
import {
    TestKitArrayToRecord,
    ClassTypeOf,
    CombinedTestKitsResult
} from './types';

/** A test kit describe the way of how building a test data for a module and provide the tools to ask the questions on that module. */
export abstract class TestKit {
    protected dependentTestKits: Array<TestKit> = [];
    protected _dependentTestKitsMap: TestKitArrayToRecord<Array<TestKit>> = {};

    getDependentTestKitsMap<
        DepKits extends Array<TestKit>
    >(): TestKitArrayToRecord<DepKits> {
        return this._dependentTestKitsMap as TestKitArrayToRecord<DepKits>;
    }

    get dependentTestKitsClasses(): ClassTypeOf<Array<TestKit>> {
        return [];
    }
    abstract result: unknown;
    protected _isLoaded: boolean = false;

    get isLoaded() {
        return this._isLoaded;
    }

    markAsLoaded() {
        this._isLoaded = true;
    }

    defaultCallback?: () => void;

    abstract get name(): string;

    init(props?: any): void {

    }

    setDependentTestKits(dependentTestKits: Array<TestKit>) {
        this.dependentTestKits = dependentTestKits;
        this._dependentTestKitsMap =
            buildTestKitRecordFromArray(dependentTestKits);
    }

    get dependentTestKitsResult(): CombinedTestKitsResult<Array<TestKit>> {
        return Object.assign(
            {},
            ...this.dependentTestKits.map(testKit => testKit.result)
        );
    }
    initDependentTestKitsIfNeeded({
        dependencyChain = []
    }: {
        dependencyChain?: string[];
    } = {}) {
        this.dependentTestKits.forEach((dependentTestKit: TestKit) => {
            if (dependentTestKit.isLoaded) {
                return;
            }

            dependentTestKit.initDependentTestKitsIfNeeded({
                dependencyChain: [...dependencyChain, this.constructor.name]
            });

            if (!dependentTestKit.defaultCallback) {
                throw new Error(
                    `TestKit ${
                        dependentTestKit.constructor.name
                    } does not have a defaultCallback and was not init, you should or init the test kit manually with calling "with" method or add a "defaultCallback"; It was called from: ${dependencyChain.join(
                        ' -> '
                    )}`
                );
            }

            dependentTestKit.defaultCallback();
            dependentTestKit.markAsLoaded();
        });
    }
}
