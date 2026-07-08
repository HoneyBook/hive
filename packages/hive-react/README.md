# @honeybook/hive-react

React Testing Library integration for hive — a runner that renders components/hooks inside a kit-driven provider stack.

## Installation

```bash
pnpm add -D @honeybook/hive-react @testing-library/react@>=11 react@>=17
```

## Usage

```ts
import React from "react";
import { TestKit } from "@honeybook/hive";
import type { IProviderTestKit } from "@honeybook/hive-react";
import { createReactTestRunner } from "@honeybook/hive-react";

// Provider kit
class ProviderKit extends TestKit implements IProviderTestKit {
  result = { providerId: "default" };
  get name() {
    return "ProviderKit";
  }
  defaultCallback = () => {};
  Provider() {
    return ({ children }: { children?: React.ReactNode }) => (
      <div data-testid="provider">{children}</div>
    );
  }
}

// Data kit
class UserKit extends TestKit {
  result = { userId: "user123" };
  get name() {
    return "UserKit";
  }
  defaultCallback = () => {};
}

it("renders a component with providers and accesses kit data", async () => {
  const runner = createReactTestRunner([ProviderKit, UserKit]);
  // First kit in array is the outermost provider
  const result = runner.render(<div data-testid="target">Hello</div>);
  expect(result.ui.getByTestId("target").textContent).toBe("Hello");
  await runner.run();
});

it("renders a hook with typed result", async () => {
  const runner = createReactTestRunner([ProviderKit, UserKit]);
  const { result } = runner.renderHook(() => ({ value: 42 }));
  const value: number = result.current.value;
  expect(value).toBe(42);
});
```

## API

- `createReactTestRunner` — factory for a React test runner with `render`/`renderHook`
- `REACT_BASE_KITS` — the base kit set injected into every React runner
- `ReactBaseKits` — type of `REACT_BASE_KITS`
- `ReactRenderMethods` — type of the `render`/`renderHook` methods added to the runner
- `withBeforeRender` — chainable runner method registering a callback fired with the seeded `result` just before each `render`/`renderComponent`/`renderHook`; multiple calls accumulate in registration order
- `createReactTestRunnerWithQueries` — factory variant accepting custom RTL queries
- `generateProviderStack` — composes kit `Provider()`s into a nested provider tree
- `IProviderTestKit` — interface a kit implements to contribute a provider
- `ReactTestKit` — base kit that seeds the RTL render result into `runner.result.ui`
- `ReactTestKitWithQueries` — `ReactTestKit` variant carrying custom queries

## Peer Dependencies

- `@testing-library/react: >=11`
- `react: >=17`
