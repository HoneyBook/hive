# @honeybook/hive

**HoneyBook Test Kits Infrastructure Package**

A powerful testing framework infrastructure that provides base classes and utilities for creating structured, dependency-aware testing environments.

## 📦 **What's Included**

### **Base Classes**

- `TestKit` - Abstract base class for creating test kits
- `TestAppRunner` - Base class for combining test kits into app runners
- `RenderTestKit` - Base class for React component test kits

### **Utilities**

- `buildTestKitRecordFromArray` - Convert test kit arrays to keyed records
- `collectImplicitDependenciesDeep` - Resolve transitive test kit dependencies
- `createAppRunner` - Factory function for creating app runners

### **TypeScript Types**

- `TestKitArrayToRecord` - Convert test kit arrays to record types
- `DependsOn` - Helper for declaring test kit dependencies
- `CombinedTestKitsResult` - Combine results from multiple test kits
- `AppRunnerWithChainableTestKitsMethods` - Chainable method types

## 🚀 **Usage**

### **Creating a Test Kit**

```typescript
import { TestKit } from "@honeybook/hive";

export class UserTestKit extends TestKit {
  result = {
    user: null as User | null,
    isLoggedIn: false,
  };

  get name() {
    return "UserTestKit";
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
    project: null as Project | null,
  };

  get name() {
    return "ProjectTestKit";
  }

  withProject(project: Project) {
    // Access the user from the dependent test kit
    const { user } = this.getDependentTestKitsMap().UserTestKit.result;

    this.result.project = { ...project, ownerId: user?.id };
    return this;
  }
}
```

### **Derived Payloads**

Sometimes a `with*` payload isn't known up front — it depends on another kit's built data (a conversation that references an attachment's id, a login that uses the seeded user's email). Instead of hard-coding the dependency inside the kit's `build()`, derive the payload inline at the call site. There are two forms.

**Eager — `(result) => payload` (synchronous kits).** Pass a callback as the first argument to a `with*`. It runs immediately, at chain-construction time, and receives the runner's combined `result` as it stands so far:

```typescript
runner
  .withUser({ id: "u_1", email: "a@b.co" })
  .withProfile((result) => ({ ownerEmail: result.email }));
```

This reads the synchronous `result` of kits already applied. It is only meaningful when the data it reads has already been produced synchronously — which is the case for plain `TestKit`s, whose `with*` populates `result` in realtime.

**Deferred — `runner.defer(async (kits) => payload)` (async kits).** An `AsyncTestKit`'s `result` isn't populated until the runner flushes it (`await runner.run()`), so the eager form would read empty data. `runner.defer()` instead delays the `with*` call to resolve-time, after dependencies have been built, and hands the callback the runner's `testKitsMap` so it can `await` any kit's resolved `value`:

```typescript
runner.withAttachment("att_99").withConversation(
  runner.defer(async (kits) => ({
    linkedAttachmentId: (await kits.AttachmentKit.value).attachmentId,
  })),
);

const result = await runner.run(); // conversation seeded with the resolved attachment id
```

Notes:

- **Async-only.** `runner.defer()` is only valid on an `AsyncTestKit`'s `with*`. Passing the result to a synchronous kit's `with*` throws — use the eager `(result) => payload` form there instead.
- **Await, don't read.** Inside the callback, read dependencies via `await kits.X.value` (the memoized async result), never `kits.X.result` (which may not be settled yet). Ordering self-organizes: each kit's `build()`/deferred callback awaits what it needs.
- **Typed kit access requires a literal `name`.** For `kits.X` to resolve to a specific kit (rather than a union of all kits), the kit's `name` getter must be typed as a string literal — `get name(): "AttachmentKit"` — as the codebase already does by convention.

## 🏗️ **Architecture**

The hive package provides a **dependency-aware testing framework** where:

1. **Test Kits** encapsulate test data setup for specific domains
2. **Dependencies** are automatically resolved and initialized
3. **App Runners** combine test kits and provide rendering capabilities
4. **Type Safety** ensures proper usage with full TypeScript support

## 📋 **API Reference**

### **TestKit (Abstract)**

- `abstract result: unknown` - Test data result
- `abstract get name(): string` - Test kit name
- `get dependentTestKitClasses()` - Declare dependencies
- `beforeWith()` - Hook called before any with method
- `defaultCallback?` - Default initialization function

### **TestAppRunner (Abstract)**

- `get result()` - Combined results from all test kits
- `abstract render()` - Render the application
- `abstract renderComponent()` - Render specific components
- `setup()` - Initialize test kit bindings
- `initAllTestKitsWithDefaults()` - Initialize with defaults

### **Utilities**

- `createAppRunner({ appRunnerClass })` - Factory for creating app runners
- `buildTestKitRecordFromArray(testKits)` - Convert array to keyed record
- `collectImplicitDependenciesDeep(testKitsMap)` - Resolve dependencies

## 🔗 **Integration**

This package is designed to work with:

- **React Testing Library** for component testing
- **Jest** for test execution
- **TypeScript** for type safety
- **Other HoneyBook packages** for domain-specific functionality

## 📝 **Best Practices**

1. **Keep test kits focused** - Each test kit should handle one domain
2. **Use dependencies wisely** - Declare dependencies for shared state
3. **Provide defaults** - Add `defaultCallback` for automatic initialization
4. **Type everything** - Leverage TypeScript for better developer experience
5. **Test your test kits** - Write tests for complex test kit behavior

---

_This infrastructure package enables building robust, maintainable test frameworks that scale with your application's complexity._
