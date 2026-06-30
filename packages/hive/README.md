# @honeybook/hive

**HoneyBook Test Kits Infrastructure Package**

A powerful testing framework infrastructure that provides base classes and utilities for creating structured, dependency-aware testing environments.

## 📦 **What's Included**

### **Base Classes**

-   `TestKit` - Abstract base class for creating test kits
-   `TestAppRunner` - Base class for combining test kits into app runners
-   `RenderTestKit` - Base class for React component test kits

### **Utilities**

-   `buildTestKitRecordFromArray` - Convert test kit arrays to keyed records
-   `collectImplicitDependenciesDeep` - Resolve transitive test kit dependencies
-   `createAppRunner` - Factory function for creating app runners

### **TypeScript Types**

-   `TestKitArrayToRecord` - Convert test kit arrays to record types
-   `DependsOn` - Helper for declaring test kit dependencies
-   `CombinedTestKitsResult` - Combine results from multiple test kits
-   `AppRunnerWithChainableTestKitsMethods` - Chainable method types

## 🚀 **Usage**

### **Creating a Test Kit**

```typescript
import { TestKit } from '@honeybook/hive';

export class UserTestKit extends TestKit {
    result = {
        user: null as User | null,
        isLoggedIn: false
    };

    get name() {
        return 'UserTestKit';
    }

    withUser(user: User) {
        this.result.user = user;
        this.result.isLoggedIn = true;
        return this;
    }

    withLoggedOutUser() {
        this.result.user = null;
        this.result.isLoggedIn = false;
        return this;
    }
}
```

### **Creating an App Runner**

```typescript
import { TestAppRunner, createAppRunner } from '@honeybook/hive';
import { UserTestKit } from './user.test-kit';
import { ProjectTestKit } from './project.test-kit';

class MyAppTestRunner extends TestAppRunner<
    [typeof UserTestKit, typeof ProjectTestKit]
> {
    constructor() {
        super({
            testKitsClasses: [UserTestKit, ProjectTestKit]
        });
    }

    render() {
        return <MyApp {...this.result} />;
    }

    renderComponent(component) {
        if (typeof component === 'function') {
            return component(this.result);
        }
        return component;
    }
}

// Usage in tests
const appRunner = createAppRunner({ appRunnerClass: MyAppTestRunner });

const result = appRunner.withUser(someUser).withProject(someProject).render();
```

### **Dependency Management**

Test kits can declare dependencies on other test kits:

```typescript
export class ProjectTestKit extends TestKit {
    // Declare that this test kit depends on UserTestKit
    get dependentTestKitClasses() {
        return [UserTestKit];
    }

    result = {
        project: null as Project | null
    };

    get name() {
        return 'ProjectTestKit';
    }

    withProject(project: Project) {
        // Access the user from the dependent test kit
        const { user } = this.getDependentTestKitsMap().UserTestKit.result;

        this.result.project = { ...project, ownerId: user?.id };
        return this;
    }
}
```

## 🏗️ **Architecture**

The hive package provides a **dependency-aware testing framework** where:

1. **Test Kits** encapsulate test data setup for specific domains
2. **Dependencies** are automatically resolved and initialized
3. **App Runners** combine test kits and provide rendering capabilities
4. **Type Safety** ensures proper usage with full TypeScript support

## 📋 **API Reference**

### **TestKit (Abstract)**

-   `abstract result: unknown` - Test data result
-   `abstract get name(): string` - Test kit name
-   `get dependentTestKitClasses()` - Declare dependencies
-   `beforeWith()` - Hook called before any with method
-   `defaultCallback?` - Default initialization function

### **TestAppRunner (Abstract)**

-   `get result()` - Combined results from all test kits
-   `abstract render()` - Render the application
-   `abstract renderComponent()` - Render specific components
-   `setup()` - Initialize test kit bindings
-   `initAllTestKitsWithDefaults()` - Initialize with defaults

### **Utilities**

-   `createAppRunner({ appRunnerClass })` - Factory for creating app runners
-   `buildTestKitRecordFromArray(testKits)` - Convert array to keyed record
-   `collectImplicitDependenciesDeep(testKitsMap)` - Resolve dependencies

## 🔗 **Integration**

This package is designed to work with:

-   **React Testing Library** for component testing
-   **Jest** for test execution
-   **TypeScript** for type safety
-   **Other HoneyBook packages** for domain-specific functionality

## 📝 **Best Practices**

1. **Keep test kits focused** - Each test kit should handle one domain
2. **Use dependencies wisely** - Declare dependencies for shared state
3. **Provide defaults** - Add `defaultCallback` for automatic initialization
4. **Type everything** - Leverage TypeScript for better developer experience
5. **Test your test kits** - Write tests for complex test kit behavior

---

_This infrastructure package enables building robust, maintainable test frameworks that scale with your application's complexity._
