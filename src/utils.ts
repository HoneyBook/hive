import { TestKit } from './test-kit';
import { TestKitArrayToRecord } from './types';

export function buildTestKitRecordFromArray<TestKits extends TestKit[]>(
    testKits: TestKit[]
) {
    return testKits.reduce((result, testKit) => {
        result[testKit.name] = testKit;

        return result;
    }, {} as TestKitArrayToRecord<TestKits>);
}
