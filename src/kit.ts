import { buildKitRecordFromArray } from './utils';
import {
    KitArrayToRecord,
    ClassTypeOf,
    CombinedKitsResult
} from './types';

export interface KitOptions {
    defaultCallback?: () => void;
    shouldAlwaysInit?: boolean;
    dependentKitsClasses?: ClassTypeOf<Array<Kit>>;
}

/** A kit describe the way of how building a test data for a module and provide the tools to ask the questions on that module. */
export abstract class Kit {
    abstract get name(): string;
    abstract result: unknown;
    protected _isLoaded: boolean = false;
    protected dependentKits: Array<Kit> = [];
    protected _dependentKitsMap: KitArrayToRecord<Array<Kit>> = {};
    readonly defaultCallback?: () => void;
    readonly shouldAlwaysInit: boolean;
    readonly dependentKitsClasses: ClassTypeOf<Array<Kit>>;

    get dependentKitsResult(): CombinedKitsResult<Array<Kit>> {
        return Object.assign(
            {},
            ...this.dependentKits.map(kit => kit.result)
        );
    }

    get isLoaded() {
        return this._isLoaded;
    }

    constructor({defaultCallback, shouldAlwaysInit = false, dependentKitsClasses = []}: KitOptions = {}) {
        this.defaultCallback = defaultCallback;
        this.shouldAlwaysInit = shouldAlwaysInit;
        this.dependentKitsClasses = dependentKitsClasses;
    }

    init(props?: any): void {

    }

    getDependentKits<
        DepKits extends Array<Kit>
    >(): KitArrayToRecord<DepKits> {
        return this._dependentKitsMap as KitArrayToRecord<DepKits>;
    }

    initDependentKitsIfNeeded({
                                  dependencyChain = []
                              }: {
        dependencyChain?: string[];
    } = {}) {
        this.dependentKits.forEach((dependentKit: Kit) => {
            if (dependentKit.isLoaded) {
                return;
            }

            dependentKit.initDependentKitsIfNeeded({
                dependencyChain: [...dependencyChain, this.constructor.name]
            });

            if (!dependentKit.defaultCallback) {
                throw new Error(
                    `Kit ${
                        dependentKit.constructor.name
                    } does not have a defaultCallback and was not init, you should or init the kit manually with calling "with" method or add a "defaultCallback"; It was called from: ${dependencyChain.join(
                        ' -> '
                    )}`
                );
            }

            dependentKit.defaultCallback();
            dependentKit.markAsLoaded();
        });
    }

    setDependentKits(dependentKits: Array<Kit>) {
        this.dependentKits = dependentKits;
        this._dependentKitsMap =
            buildKitRecordFromArray(dependentKits);
    }

    markAsLoaded() {
        this._isLoaded = true;
    }
}
