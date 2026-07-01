# @honeybook/eslint-plugin-hive

ESLint rules that steer hive consumers away from raw `jest.mock`/`vi.mock`/`spyOn` toward the `MockAdapter` pattern.

## Installation

```bash
pnpm add -D @honeybook/eslint-plugin-hive
```

## Usage

Import the plugin and enable the `recommended` config in your flat-config ESLint setup:

```js
import hive from "@honeybook/eslint-plugin-hive";

export default [
  hive.configs.recommended,
  // or wire rules manually:
  // { plugins: { hive }, rules: { "hive/no-mock": "error", "hive/no-spy-on": "error" } },
];
```

## Rules

### hive/no-mock

Bans `jest.mock()` / `vi.mock()`. Use hive's MockAdapter pattern instead of raw module mocking.

**Before:**
```ts
vi.mock('./greeter');
```

**After:**
```ts
// greeter.mock.ts
export class GreeterMock {
  greet = vi.fn();
}

// test
const greeter = new MockAdapter(GreeterMock);
```

With `mockSubstitutionPlugin` configured in vitest, imports automatically resolve to `.mock.ts` files.

### hive/no-spy-on

Bans `jest.spyOn()` / `vi.spyOn()`. Use hive's MockAdapter pattern — spies are injected automatically.

**Before:**
```ts
const greeter = new Greeter();
vi.spyOn(greeter, 'greet');
```

**After:**
```ts
const greeter = new MockAdapter(Greeter);
// Every method is auto-spied; use greeter.greet.mock.calls, etc.
```

## Recommended Config

The `recommended` config enables both rules as `error`:

```json
{
  "rules": {
    "hive/no-mock": "error",
    "hive/no-spy-on": "error"
  }
}
```
