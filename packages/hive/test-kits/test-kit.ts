import { buildTestKitRecordFromArray } from './test-kit.utils';
import { TestKitArrayToRecord, DependsOn } from './test-kits.types';

/** A test kit describe the way of how building a test data for a module and provide the tools to ask the questions on that module. */
export abstract class TestKit<Dependencies extends Array<TestKit> = any[]> {
    protected dependentTestKits: Array<TestKit> = [];
    protected _dependentTestKitsMap: TestKitArrayToRecord<Dependencies> = {} as TestKitArrayToRecord<Dependencies>;

    /**
     * Backward-compat overload: explicit type param still accepted at call sites.
     * Primary usage: call without a type param — return type is inferred from the class generic.
     */
    getDependentTestKitsMap<
        DepKits extends Array<TestKit> = Dependencies
    >(): TestKitArrayToRecord<DepKits> {
        return this
            ._dependentTestKitsMap as unknown as TestKitArrayToRecord<DepKits>;
    }

    /**
     * Override in subclasses with `as const` to satisfy the typed return constraint.
     * TypeScript enforces the returned constructors match the class generic `Dependencies`.
     */
    get dependentTestKitClasses(): Readonly<DependsOn<Dependencies>> {
        return [] as Readonly<DependsOn<Dependencies>>;
    }

    abstract result: unknown;
    protected _wasInit = false;

    get wasInit() {
        return this._wasInit;
    }

    markAsInit() {
        this._wasInit = true;
    }

    defaultCallback?: () => void;

    abstract get name(): string;

    beforeWith(): void {}

    /**
     * Runs once, before the first `with*` call on this kit. Override for
     * one-time setup that must not repeat (e.g., adapter wiring).
     * Use `beforeWith` for work that should re-run on every `with*` call.
     */
    init(): void {}

    setDependentTestKits(dependentTestKits: Array<TestKit>) {
        this.dependentTestKits = dependentTestKits;
        this._dependentTestKitsMap =
            buildTestKitRecordFromArray(dependentTestKits);
    }

    initDependentTestKitsIfNeeded({
        dependencyChain = []
    }: {
        dependencyChain?: string[];
    } = {}) {
        this.dependentTestKits.forEach((dependentTestKit: TestKit) => {
            if (dependentTestKit.wasInit) {
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

            dependentTestKit.defaultInit();
        });
    }

    defaultInit() {
        const callback = this.defaultCallback;
        if (callback === undefined) {
            throw new Error(`TestKit ${this.constructor.name} does not have a defaultCallback`);
        }
        this.callWith(callback, []);
    }

    callWith(withMethod: (...args: any[]) => any, props: any[]) {
        if (!this.wasInit) {
            this.init();
        }
        this.beforeWith();
        withMethod.apply(this, props);
        this.markAsInit();
    }
}
