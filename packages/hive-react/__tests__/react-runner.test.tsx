import React from 'react';
import { screen, buildQueries } from '@testing-library/react';
import { TestKit } from '@honeybook/hive';
import type { IProviderTestKit } from '../src/IProviderTestKit';
import { createReactTestRunner } from '../src/createReactTestRunner';
import { createReactTestRunnerWithQueries } from '../src/createReactTestRunnerWithQueries';

// ─── Test kits ─────────────────────────────────────────────────────────────

class OuterKit extends TestKit implements IProviderTestKit {
  result = { outer: true };
  get name() { return 'OuterKit'; }
  defaultCallback = () => {};
  Provider() {
    return ({ children }: { children?: React.ReactNode }) =>
      <div data-testid="outer">{children}</div>;
  }
}

class InnerKit extends TestKit implements IProviderTestKit {
  result = { inner: true };
  get name() { return 'InnerKit'; }
  defaultCallback = () => {};
  Provider() {
    return ({ children }: { children?: React.ReactNode }) =>
      <div data-testid="inner">{children}</div>;
  }
}

class UserKit extends TestKit {
  result: { userId: string } = { userId: 'default' };
  get name() { return 'UserKit'; }
  withUserId(id: string) { this.result = { userId: id }; }
  defaultCallback = () => this.withUserId('default');
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('createReactTestRunner', () => {
  it('render() fires run() without awaiting and returns runner.result with RTL query functions', async () => {
    const runner = createReactTestRunner([UserKit]);
    const result = runner.render(<div data-testid="target">hello</div>);
    expect(result.getByTestId('target').textContent).toBe('hello');
    await expect(runner.run()).resolves.toBeDefined();
  });

  it('renderHook() returns RTL RenderHookResult with generic params preserved', async () => {
    const runner = createReactTestRunner([UserKit]);
    // BaseMethods are intersected directly (not through RunnerMethodMap), so
    // renderHook<Result, Props> generics are preserved — no cast needed.
    const { result } = runner.renderHook(() => ({ value: 42 }));
    const value: number = result.current.value;
    expect(value).toBe(42);
  });

  it('provider stack: first kit in array = outermost provider', () => {
    const runner = createReactTestRunner([OuterKit, InnerKit]);
    runner.render(<span data-testid="child">content</span>);
    const outer = screen.getByTestId('outer');
    const inner = screen.getByTestId('inner');
    expect(outer.contains(inner)).toBe(true);
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('consumer non-void extraMethod returns its actual value', () => {
    const runner = createReactTestRunner([UserKit], {
      getValue(): string {
        return 'from-extra';
      },
    });
    const v = runner.getValue();
    expect(v).toBe('from-extra');
  });

  it('consumer void extraMethod still chains', () => {
    const runner = createReactTestRunner([UserKit], {
      withCustomId(): void {
        // void extra method
      },
    });
    // withCustomId() returns the runner — verify the chain lands on a kit method.
    // Note: BaseMethods (render etc.) are intersected on the outer return type, so they
    // are not present on the intermediate chain type. Use a kit method to verify chaining,
    // then call render on the original runner.
    runner.withCustomId().withUserId('chained-test');
    const result = runner.render(<div data-testid="chained">ok</div>);
    expect(result.getByTestId('chained')).toBeTruthy();
  });

  it('getProviders wraps INSIDE the kit provider stack', () => {
    const runner = createReactTestRunner(
      [OuterKit],
      undefined,
      () => ({ children }: { children?: React.ReactNode }) =>
        <div data-testid="extra">{children}</div>
    );
    runner.render(<span data-testid="inner-content">x</span>);
    const outer = screen.getByTestId('outer');
    const extra = screen.getByTestId('extra');
    expect(outer.contains(extra)).toBe(true);
  });

  it('runner.result contains both kit results and RTL query functions after render', () => {
    const runner = createReactTestRunner([UserKit]);
    runner.withUserId('test-123');
    runner.render(<div data-testid="check">rendered</div>);
    // Kit result — typed on runner.result
    expect(runner.result.userId).toBe('test-123');
    // RTL result seeded into runner.result via ReactTestKit; ReactTestKit is now in BaseKits
    // so runner.result includes getByTestId without any cast.
    expect(runner.result.getByTestId('check').textContent).toBe('rendered');
  });
});

describe('createReactTestRunnerWithQueries', () => {
  it('custom queries: runner.result exposes custom query methods', () => {
    // Define a simple custom query by data-custom attribute
    const queryAllByDataCustom = (container: HTMLElement, value: string) =>
      Array.from(container.querySelectorAll<HTMLElement>(`[data-custom="${value}"]`));
    const [, , getByDataCustom] = buildQueries(
      queryAllByDataCustom,
      (_c, v) => `Found multiple elements with data-custom="${v}"`,
      (_c, v) => `Unable to find element with data-custom="${v}"`
    );
    const customQueries = { queryAllByDataCustom, getByDataCustom };

    const runner = createReactTestRunnerWithQueries(
      [UserKit],
      undefined,
      undefined,
      customQueries
    );
    runner.render(<div data-custom="foo">bar</div>);
    const el = runner.result.getByDataCustom('foo') as HTMLElement;
    expect(el.textContent).toBe('bar');
  });
});
