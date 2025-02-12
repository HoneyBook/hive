import { UnionToIntersection } from 'type-fest';
import { TestKit } from './test-kit';
import { TestAppRunner } from './test-app-runner';

/** Destruct the first item type in the array out and keep the rest */
export type Tail<T extends any[]> = T extends [T[0], ...infer Rest] ? Rest : [];

// TestKit and AppRunner magic types

/** Combine all the results of the provided test kits */
export type CombinedTestKitsResult<TestKits extends Array<TestKit> = []> =
    UnionToIntersection<TestKits[number]['result']>;


/** Extract all the "withX" methods from test kits and change their first arg to be able to receive function.
 *  This function has only one arg that is the result of all the test kits.
 *  The idea is that you can use test kits result that were init before calling this test method in order to create
 *  the fixture data.*/
export type WithTestKitMethodBuilderSupport<
    TTestKit extends TestKit,
    AllTestKits extends Array<TestKit>
> = {
    [Key in keyof TTestKit as Key extends `with${string}`
        ? TTestKit[Key] extends (...args: any[]) => any
            ? Key
            : never
        : never]: TTestKit[Key] extends (...args: infer Args) => infer Return
        ? (
              ...args:
                  | Args
                  | [
                        testKitsResultOverloadFunction: (
                            result: CombinedTestKitsResult<AllTestKits>
                        ) => Args[0],
                        ...args: Tail<Args>
                    ]
          ) => Return
        : never;
};

/** Combine the provided test kits methods as builder test kit methods */
export type CombineTestKitsBuilderMethods<TestKits extends Array<TestKit>> =
    UnionToIntersection<
        WithTestKitMethodBuilderSupport<TestKits[number], TestKits>
    >;

/** Convert all the "withX" builder methods to support chaining with the provided app runner.
 * This type basically add support to `testAppRunner.withX().withOtherX();`
 * The original with methods of the test kits doesn't know their app runner so this a way of enabling it */
export type AppRunnerWithChainableTestKitsMethods<
    TestKits extends Array<TestKit>,
    AppRunner extends TestAppRunner<TestKits>
> = AppRunner & {
    [Key in keyof CombineTestKitsBuilderMethods<TestKits>]: (
        ...args: Parameters<CombineTestKitsBuilderMethods<TestKits>[Key]>
    ) => AppRunner & AppRunnerWithChainableTestKitsMethods<TestKits, AppRunner>;
};

// Other types

export type TestKitArrayToRecord<T extends Array<TestKit>> = {
    [Key in T[number] as Key['name']]: Key;
};

export type TypeOf<T> = new (...args: any[]) => T;

// TODO: Need to make this type to enforce you to provide the correct type for the dependentTestKits
export type ClassTypeOf<DependentTestKits extends Array<TestKit> = []> = Array<
    TypeOf<DependentTestKits[number]>
>;
