import { UnionToIntersection } from 'type-fest';
import { Kit } from './kit';
import { Runner } from './runner';

/** Destruct the first item type in the array out and keep the rest */
export type Tail<T extends any[]> = T extends [T[0], ...infer Rest] ? Rest : [];

// Kit and AppRunner magic types

/** Combine all the results of the provided kits */
export type CombinedKitsResult<Kits extends Array<Kit> = []> =
    UnionToIntersection<Kits[number]['result']>;


/** Extract all the "withX" methods from kits and change their first arg to be able to receive function.
 *  This function has only one arg that is the result of all the kits.
 *  The idea is that you can use kits result that were init before calling this method in order to create
 *  the fixture data.*/
export type WithKitMethodBuilderSupport<
    TKit extends Kit,
    AllKits extends Array<Kit>
> = {
    [Key in keyof TKit as Key extends `with${string}`
        ? TKit[Key] extends (...args: any[]) => any
            ? Key
            : never
        : never]: TKit[Key] extends (...args: infer Args) => infer Return
        ? (
              ...args:
                  | Args
                  | [
                        kitsResultOverloadFunction: (
                            result: CombinedKitsResult<AllKits>
                        ) => Args[0],
                        ...args: Tail<Args>
                    ]
          ) => Return
        : never;
};

/** Combine the provided kits methods as builder kit methods */
export type CombineKitsBuilderMethods<Kits extends Array<Kit>> =
    UnionToIntersection<
        WithKitMethodBuilderSupport<Kits[number], Kits>
    >;

/** Convert all the "withX" builder methods to support chaining with the provided app runner.
 * This type basically add support to `appRunner.withX().withOtherX();`
 * The original with methods of the kits doesn't know their app runner so this a way of enabling it */
export type AppRunnerWithChainableKitsMethods<
    Kits extends Array<Kit>,
    AppRunner extends Runner<Kits>
> = AppRunner & {
    [Key in keyof CombineKitsBuilderMethods<Kits>]: (
        ...args: Parameters<CombineKitsBuilderMethods<Kits>[Key]>
    ) => AppRunner & AppRunnerWithChainableKitsMethods<Kits, AppRunner>;
};

// Other types

export type KitArrayToRecord<T extends Array<Kit>> = {
    [Key in T[number] as Key['name']]: Key;
};

export type TypeOf<T> = new (...args: any[]) => T;

// TODO: Need to make this type to enforce you to provide the correct type for the dependentKits
export type ClassTypeOf<DependentKits extends Array<Kit> = []> = Array<
    TypeOf<DependentKits[number]>
>;
