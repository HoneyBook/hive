import { TestKit, AsyncTestKit } from '@honeybook/hive';
import { createBaseTestRunner } from '../src/createBaseTestRunner';

// --- Sync kit ---
class CounterKit extends TestKit {
  result: { count: number } = { count: 0 };
  get name() { return 'CounterKit'; }

  withCount(n: number): void {
    this.result = { count: n };
  }
  defaultCallback = () => this.withCount(1);
}

// --- Async kit ---
let buildCallCount = 0;

class AsyncGreetKit extends AsyncTestKit<{ greeting: string }> {
  get name() { return 'AsyncGreetKit'; }

  protected async build(): Promise<{ greeting: string }> {
    buildCallCount++;
    return { greeting: 'hello' };
  }
}

describe('createBaseTestRunner — base runner (Pattern C)', () => {
  beforeEach(() => {
    buildCallCount = 0;
  });

  it('resolves sync + async kit results after run()', async () => {
    const runner = createBaseTestRunner([CounterKit, AsyncGreetKit]);
    runner.withCount(42);

    const r = await runner.run();

    // Both kit fields are present and correctly typed (no `unknown` cast)
    const count: number = r.count;
    const greeting: string = r.greeting;

    expect(count).toBe(42);
    expect(greeting).toBe('hello');
  });

  it('memoizes run() — same promise reference, build() fires exactly once', async () => {
    const runner = createBaseTestRunner([CounterKit, AsyncGreetKit]);

    const p1 = runner.run();
    const p2 = runner.run();

    // Same promise reference
    expect(p1).toBe(p2);

    await p1;

    // build() fired once
    expect(buildCallCount).toBe(1);
  });
});
