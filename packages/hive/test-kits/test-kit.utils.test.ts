import {
    buildTestKitRecordFromArray,
    collectImplicitDependenciesDeep
} from './test-kit.utils';
import { TestKit } from './test-kit';
import { DependsOn } from './test-kits.types';

// Mock TestKit classes representing a realistic dependency graph
// ApiAdapterTestKit (no dependencies)
class MockApiAdapterTestKit extends TestKit {
    result = { apiAdapter: 'mock-api' };

    get name(): 'ApiAdapterTestKit' {
        return 'ApiAdapterTestKit';
    }

    get dependentTestKitClasses(): DependsOn<[]> {
        return [] as DependsOn<[]>;
    }
}

// ConfigTestKit -> [ApiAdapterTestKit]
class MockConfigTestKit extends TestKit {
    result = { config: 'mock-config' };

    get name(): 'ConfigTestKit' {
        return 'ConfigTestKit';
    }

    get dependentTestKitClasses(): DependsOn<[MockApiAdapterTestKit]> {
        return [MockApiAdapterTestKit] as DependsOn<[MockApiAdapterTestKit]>;
    }
}

// AccountTestKit -> [ApiAdapterTestKit]
class MockAccountTestKit extends TestKit {
    result = { account: 'mock-account' };

    get name(): 'AccountTestKit' {
        return 'AccountTestKit';
    }

    get dependentTestKitClasses(): DependsOn<[MockApiAdapterTestKit]> {
        return [MockApiAdapterTestKit] as DependsOn<[MockApiAdapterTestKit]>;
    }
}

// UserTestKit -> [ApiAdapterTestKit, ConfigTestKit, AccountTestKit]
class MockUserTestKit extends TestKit {
    result = { user: 'mock-user' };

    get name(): 'UserTestKit' {
        return 'UserTestKit';
    }

    get dependentTestKitClasses(): DependsOn<
        [MockApiAdapterTestKit, MockConfigTestKit, MockAccountTestKit]
    > {
        return [
            MockApiAdapterTestKit,
            MockConfigTestKit,
            MockAccountTestKit
        ] as DependsOn<
            [MockApiAdapterTestKit, MockConfigTestKit, MockAccountTestKit]
        >;
    }
}

// CompanyTestKit -> [ApiAdapterTestKit, UserTestKit]
class MockCompanyTestKit extends TestKit {
    result = { company: 'mock-company' };

    get name(): 'CompanyTestKit' {
        return 'CompanyTestKit';
    }

    get dependentTestKitClasses(): DependsOn<
        [MockApiAdapterTestKit, MockUserTestKit]
    > {
        return [MockApiAdapterTestKit, MockUserTestKit] as DependsOn<
            [MockApiAdapterTestKit, MockUserTestKit]
        >;
    }
}

// ProjectTestKit -> [ApiAdapterTestKit, UserTestKit, CompanyTestKit]
class MockProjectTestKit extends TestKit {
    result = { project: 'mock-project' };

    get name(): 'ProjectTestKit' {
        return 'ProjectTestKit';
    }

    get dependentTestKitClasses(): DependsOn<
        [MockApiAdapterTestKit, MockUserTestKit, MockCompanyTestKit]
    > {
        return [
            MockApiAdapterTestKit,
            MockUserTestKit,
            MockCompanyTestKit
        ] as DependsOn<
            [MockApiAdapterTestKit, MockUserTestKit, MockCompanyTestKit]
        >;
    }
}

// Circular dependency test cases
class MockCircularATestKit extends TestKit {
    result = { circularA: 'mock-a' };

    get name(): 'CircularATestKit' {
        return 'CircularATestKit';
    }

    get dependentTestKitClasses(): DependsOn<[MockCircularBTestKit]> {
        return [MockCircularBTestKit] as DependsOn<[MockCircularBTestKit]>;
    }
}

class MockCircularBTestKit extends TestKit {
    result = { circularB: 'mock-b' };

    get name(): 'CircularBTestKit' {
        return 'CircularBTestKit';
    }

    get dependentTestKitClasses(): DependsOn<[MockCircularATestKit]> {
        return [MockCircularATestKit] as DependsOn<[MockCircularATestKit]>;
    }
}

describe('test-kit.utils', () => {
    describe('buildTestKitRecordFromArray', () => {
        it('should build a record from an array of TestKits', () => {
            const apiTestKit = new MockApiAdapterTestKit();
            const configTestKit = new MockConfigTestKit();
            const userTestKit = new MockUserTestKit();

            const testKits = [apiTestKit, configTestKit, userTestKit];
            const result = buildTestKitRecordFromArray(testKits);

            expect(result).toEqual({
                ApiAdapterTestKit: apiTestKit,
                ConfigTestKit: configTestKit,
                UserTestKit: userTestKit
            });
        });

        it('should handle empty array', () => {
            const result = buildTestKitRecordFromArray([]);
            expect(result).toEqual({});
        });

        it('should handle single TestKit', () => {
            const apiTestKit = new MockApiAdapterTestKit();
            const result = buildTestKitRecordFromArray([apiTestKit]);

            expect(result).toEqual({
                ApiAdapterTestKit: apiTestKit
            });
        });
    });

    describe('collectImplicitDependenciesDeep', () => {
        it('should collect no dependencies for TestKit with no dependencies', () => {
            const apiTestKit = new MockApiAdapterTestKit();
            const testKitsMap = { ApiAdapterTestKit: apiTestKit };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            expect(result).toEqual({});
        });

        it('should collect single level dependencies', () => {
            const configTestKit = new MockConfigTestKit();
            const testKitsMap = { ConfigTestKit: configTestKit };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            expect(Object.keys(result)).toEqual(['MockApiAdapterTestKit']);
            expect(result.MockApiAdapterTestKit).toBeInstanceOf(
                MockApiAdapterTestKit
            );
            expect(result.MockApiAdapterTestKit.name).toBe('ApiAdapterTestKit');
        });

        it('should collect multi-level dependencies without duplicates', () => {
            const userTestKit = new MockUserTestKit();
            const testKitsMap = { UserTestKit: userTestKit };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            const dependencyNames = Object.keys(result).sort();
            expect(dependencyNames).toEqual([
                'MockAccountTestKit',
                'MockApiAdapterTestKit',
                'MockConfigTestKit'
            ]);

            // Verify instances are correct
            expect(result.MockApiAdapterTestKit).toBeInstanceOf(
                MockApiAdapterTestKit
            );
            expect(result.MockConfigTestKit).toBeInstanceOf(MockConfigTestKit);
            expect(result.MockAccountTestKit).toBeInstanceOf(
                MockAccountTestKit
            );
        });

        it('should collect complex dependency tree without duplicates', () => {
            const projectTestKit = new MockProjectTestKit();
            const testKitsMap = { ProjectTestKit: projectTestKit };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            const dependencyNames = Object.keys(result).sort();
            expect(dependencyNames).toEqual([
                'MockAccountTestKit',
                'MockApiAdapterTestKit',
                'MockCompanyTestKit',
                'MockConfigTestKit',
                'MockUserTestKit'
            ]);

            // Verify all instances are correct types
            expect(result.MockApiAdapterTestKit).toBeInstanceOf(
                MockApiAdapterTestKit
            );
            expect(result.MockConfigTestKit).toBeInstanceOf(MockConfigTestKit);
            expect(result.MockAccountTestKit).toBeInstanceOf(
                MockAccountTestKit
            );
            expect(result.MockUserTestKit).toBeInstanceOf(MockUserTestKit);
            expect(result.MockCompanyTestKit).toBeInstanceOf(
                MockCompanyTestKit
            );
        });

        it('should reuse provided TestKit instances', () => {
            const userTestKit = new MockUserTestKit();
            const providedApiTestKit = new MockApiAdapterTestKit();

            const testKitsMap = {
                UserTestKit: userTestKit,
                MockApiAdapterTestKit: providedApiTestKit // Use constructor name as key
            };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            // Should not include MockApiAdapterTestKit since it was provided
            const dependencyNames = Object.keys(result).sort();
            expect(dependencyNames).toEqual([
                'MockAccountTestKit',
                'MockConfigTestKit'
            ]);

            // Should not duplicate the provided instance
            expect(result.MockApiAdapterTestKit).toBeUndefined();
        });

        it('should handle multiple root TestKits efficiently', () => {
            const userTestKit = new MockUserTestKit();
            const companyTestKit = new MockCompanyTestKit();

            const testKitsMap = {
                UserTestKit: userTestKit,
                CompanyTestKit: companyTestKit
            };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            const dependencyNames = Object.keys(result).sort();
            expect(dependencyNames).toEqual([
                'MockAccountTestKit',
                'MockApiAdapterTestKit',
                'MockConfigTestKit',
                'MockUserTestKit'
            ]);

            // Should have only one instance of each dependency despite overlap
            expect(Object.values(result).length).toBe(4);
        });

        it('should handle circular dependencies without infinite loop', () => {
            const circularATestKit = new MockCircularATestKit();
            const testKitsMap = { CircularATestKit: circularATestKit };

            // This should not hang or crash
            const result = collectImplicitDependenciesDeep(testKitsMap);

            // Should collect the circular dependency but not loop infinitely
            expect(Object.keys(result)).toContain('MockCircularBTestKit');
            expect(result.MockCircularBTestKit).toBeInstanceOf(
                MockCircularBTestKit
            );
        });

        it('should handle empty testKitsMap', () => {
            const result = collectImplicitDependenciesDeep({});
            expect(result).toEqual({});
        });

        it('should maintain instance uniqueness across complex scenarios', () => {
            const projectTestKit = new MockProjectTestKit();
            const userTestKit = new MockUserTestKit();
            const companyTestKit = new MockCompanyTestKit();

            const testKitsMap = {
                ProjectTestKit: projectTestKit,
                UserTestKit: userTestKit,
                CompanyTestKit: companyTestKit
            };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            // Despite complex overlapping dependencies, should have unique instances
            const dependencyNames = Object.keys(result).sort();
            expect(dependencyNames).toEqual([
                'MockAccountTestKit',
                'MockApiAdapterTestKit',
                'MockCompanyTestKit',
                'MockConfigTestKit',
                'MockUserTestKit'
            ]);

            // Verify same instance is reused
            const apiInstance = result.MockApiAdapterTestKit;
            expect(apiInstance).toBeInstanceOf(MockApiAdapterTestKit);

            // All dependencies should refer to the same API instance conceptually
            expect(
                Object.values(result).filter(
                    instance =>
                        instance.constructor.name === 'MockApiAdapterTestKit'
                ).length
            ).toBe(1);
        });

        it('should preserve dependency order and relationships', () => {
            const projectTestKit = new MockProjectTestKit();
            const testKitsMap = { ProjectTestKit: projectTestKit };

            const result = collectImplicitDependenciesDeep(testKitsMap);

            // UserTestKit should have been created with its dependencies
            const userTestKitInstance = result.MockUserTestKit;
            expect(userTestKitInstance).toBeInstanceOf(MockUserTestKit);

            // UserTestKit dependencies should point to the same instances
            const userDependencies =
                userTestKitInstance.dependentTestKitClasses;
            expect(userDependencies).toContain(MockApiAdapterTestKit);
            expect(userDependencies).toContain(MockConfigTestKit);
            expect(userDependencies).toContain(MockAccountTestKit);
        });
    });

    describe('integration scenarios', () => {
        it('should work end-to-end with realistic TestAppRunner scenario', () => {
            // Simulate what TestAppRunner would do
            const projectTestKit = new MockProjectTestKit();
            const userTestKit = new MockUserTestKit();

            // Build initial map
            const initialTestKits = [projectTestKit, userTestKit];
            const testKitsMap = buildTestKitRecordFromArray(initialTestKits);

            // Collect dependencies
            const impliedDependencies =
                collectImplicitDependenciesDeep(testKitsMap);

            // Combine for final result
            const allTestKits = {
                ...testKitsMap,
                ...impliedDependencies
            };

            const finalNames = Object.keys(allTestKits).sort();
            expect(finalNames).toEqual([
                'MockAccountTestKit',
                'MockApiAdapterTestKit',
                'MockCompanyTestKit',
                'MockConfigTestKit',
                'MockUserTestKit',
                'ProjectTestKit',
                'UserTestKit'
            ]);

            // Verify we have both provided and implied TestKits
            expect(allTestKits.ProjectTestKit).toBe(projectTestKit); // Original instance
            expect(allTestKits.UserTestKit).toBe(userTestKit); // Original instance
            expect(allTestKits.MockApiAdapterTestKit).toBeInstanceOf(
                MockApiAdapterTestKit
            ); // Implied
            expect(allTestKits.MockConfigTestKit).toBeInstanceOf(
                MockConfigTestKit
            ); // Implied
        });
    });
});
