import { UnionToIntersection } from 'type-fest';
import { TestAppRunner } from './test-app-runner';
import { TestKit } from '../test-kits/test-kit';

/** Destruct the first item type in the array out and keep the rest */
export type Tail<T extends any[]> = T extends [T[0], ...infer Rest] ? Rest : [];

export type TestKitsClasses<TestKits extends Array<TestKit>> = Array<
    new () => TestKits[number]
>;

export type TestKitsInstances<TKClasses extends Array<new () => TestKit>> =
    Array<InstanceType<TKClasses[number]>>;

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
type CombineTestKitsBuilderMethods<TestKits extends Array<TestKit>> =
    UnionToIntersection<
        WithTestKitMethodBuilderSupport<TestKits[number], TestKits>
    >;

/** Convert all the "withX" builder methods to support chaining with the provided app runner.
 * This type basically add support to `testAppRunner.withX().withOtherX();`
 * The original with methods of the test kits doesn't know their app runner so this a way of enabling it */
export type AppRunnerWithChainableTestKitsMethods<
    TKClasses extends TestKitsClasses<Array<TestKit>>,
    AppRunner extends TestAppRunner<TKClasses>
> = AppRunner & {
    [Key in keyof CombineTestKitsBuilderMethods<
        TestKitsInstances<TKClasses>
    >]: (
        ...args: Parameters<
            CombineTestKitsBuilderMethods<TestKitsInstances<TKClasses>>[Key]
        >
    ) => AppRunner &
        AppRunnerWithChainableTestKitsMethods<TKClasses, AppRunner>;
};
