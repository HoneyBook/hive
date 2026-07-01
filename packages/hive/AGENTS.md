# Hive

> Test kit infrastructure — base classes for building structured, dependency-aware test frameworks with composable data builders.

## At a Glance

|                  |                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| **Type**         | Shared Kernel (Test Framework)                                                                            |
| **Owns**         | `TestKit` base class, `TestAppRunner` orchestrator, dependency resolution between test kits               |
| **Does NOT own** | Concrete test kits (those live in their domain packages), mock adapters (→ `testing`), Jest configuration |
| **Users**        | All packages that define test kits for their domain                                                       |

## Navigation

↑ Parent: [`../../AGENTS.md`](../../AGENTS.md)
→ Related: [`../testing/AGENTS.md`](../testing/AGENTS.md) — MockAdapter and adapter test utilities

## Entry Points & Contracts

- `TestKit` (abstract class) — Base for all test data builders
  - **Requires:** Subclasses implement `name` (getter) and `result` (the built test data)
  - **Guarantees:** Automatic dependency resolution — dependent test kits are initialized with defaults if not explicitly configured
- `TestAppRunner` (abstract class) — Combines multiple test kits for a specific app/feature
  - **Requires:** `testKitsClasses` array in constructor, subclass implements `render()` and `renderComponent()`
  - **Guarantees:** All `with*` methods from test kits are available as chainable methods on the runner
- `createAppRunner({ appRunnerClass })` — Factory that instantiates and sets up an app runner with full type inference

## Invariants

**MUST:** Name test kit methods starting with `with` (e.g., `withUser()`, `withCompany()`) — only `with*` methods are exposed on the app runner.
**MUST:** All `with*` methods on `TestKit` subclasses must return `void`. `TestAppRunner` wraps these methods for runner chaining — returning `this` or any other value breaks TypeScript inference of the chain.
**MUST:** Define `defaultCallback` on test kits that can be auto-initialized by dependents — otherwise throws with a descriptive error and dependency chain.
**MUST NEVER:** Instantiate test kits directly in tests — use `createAppRunner()` which handles dependency wiring and method binding.

## Patterns

**TestKit dependency graph:**
Test kits declare dependencies via `dependentTestKitClasses`. When a `with*` method is called, the runner first initializes all uninitialized dependencies (using their `defaultCallback`). This is recursive — transitive dependencies are resolved automatically.

```
TestAppRunner
  ├── UserTestKit (dependsOn: [])
  ├── CompanyTestKit (dependsOn: [UserTestKit])
  └── InvoiceTestKit (dependsOn: [CompanyTestKit, UserTestKit])
```

Calling `runner.withInvoice(...)` auto-initializes `CompanyTestKit` and `UserTestKit` if not already set up.

**Chainable API:**

```ts
const runner = createAppRunner({ appRunnerClass: MyAppRunner });
runner.withUser({ name: "Test" }).withCompany({ type: "photographer" }).render();
```

**Result composition:** `runner.result` merges all test kit results into a single object via `Object.assign`.

## Pitfalls

| Trap                                                                 | Reality                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Missing `defaultCallback` on a dependency                            | Throws with full dependency chain in error message — add a `defaultCallback` or explicitly call `with*` before the dependent                                                                      |
| Adding non-`with*` public methods to test kits                       | They won't be exposed on the app runner — only methods starting with `with` are proxied                                                                                                           |
| Circular dependencies between test kits                              | Will cause infinite recursion in `initDependentTestKitsIfNeeded` — the framework doesn't detect cycles                                                                                            |
| **Returning `this` from `with*` methods**                            | If a `with*` method returns `this`, the `TestAppRunner` wrapper's TypeScript inference breaks and callers see type errors when chaining. Always declare `with*` methods as `: void`.              |
| **Calling `withX()` with no overrides to "initialize" a dependency** | Unnecessary — Hive auto-initializes all declared dependencies via `defaultCallback` when any `with*` method runs. Only call a dependency's `with*` method when you need to override its defaults. |

## Testing

```bash
pnpm --filter @honeybook/hive run type-check
```

## Dependencies

**Breaks if changed:** All test suites using `TestKit` / `TestAppRunner` across the monorepo
**Breaks us if changed:** `lodash-es` (isFunction), `type-fest` (Constructor type)
