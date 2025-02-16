import { Kit } from './kit';
import { buildKitRecordFromArray } from './utils';
import {
    KitArrayToRecord,
    AppRunnerWithChainableKitsMethods,
    CombinedKitsResult
} from './types';

function isBuilderMethod(method: string): method is `with${string}` {
    return method.startsWith('with');
}

/** Combines kits that describe a specific app for tests. */
export abstract class Runner<Kits extends Array<Kit>> {
    protected kits: Kits;
    protected kitsMap: KitArrayToRecord<Kits>;

    get result(): CombinedKitsResult<Kits> {
        return Object.assign(
            {},
            ...this.kits.map(kit => kit.result)
        );
    }

    constructor({
        kits,
    }: {
        kits: Kits;
    }) {
        this.kits = kits;
        this.kitsMap = buildKitRecordFromArray<Kits>(this.kits);

        // Dynamically bind testKit methods to the runner
        kits.forEach(kit => {
            this.loadEachKitWithItsDepKits(kit);
            this.initKit(kit);
            this.applyKitMethodsOnAppRunner(kit);
        });
    }


    private applyKitMethodsOnAppRunner(kit: Kit) {
        Object.getOwnPropertyNames(Object.getPrototypeOf(kit)).forEach(
            methodName => {
                if (!isBuilderMethod(methodName)) {
                    return;
                }

                const method = kit[methodName];
                if (typeof method != "function") {
                    return;
                }

                (this as any)[methodName] = (...props: any[]) => {
                    kit.initDependentKitsIfNeeded();

                    // If the first prop is a function, call it with the current accommodated result.
                    if (typeof props[0] == 'function') {
                        props[0] = props[0](this.result);
                    }

                    method.apply(kit, props);

                    kit.markAsLoaded();

                    return this;
                };
            }
        );
    }

    private loadEachKitWithItsDepKits(kit: Kit) {
        kit.setDependentKits(
            kit.dependentKitsClasses.map(
                dependentKitClass =>
                    this.kitsMap[dependentKitClass.name]
            )
        );
    }

    initAllKitsWithDefaults() {
        this.kits.forEach(kit => {
            if (kit.isLoaded || !kit.defaultCallback) {
                return;
            }

            kit.initDependentKitsIfNeeded();
            kit.defaultCallback();
            kit.markAsLoaded();
        });
    }

    abstract run(): CombinedKitsResult<Kits>;

    protected initKit(kit: Kit) {
        kit.init();
    }
}

export const createRunner = <
    Kits extends Array<Kit>,
    AppRunner extends Runner<Kits>
>({
    appRunnerClass
}: {
    appRunnerClass: new () => AppRunner;
}) =>
    new appRunnerClass() as AppRunnerWithChainableKitsMethods<
        Kits,
        AppRunner
    >;
