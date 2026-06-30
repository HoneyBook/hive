import { TestKit } from '@honeybook/hive';
import { createBaseTestRunner } from '../src/createBaseTestRunner';

// --- Test kit ---
class AppKit extends TestKit {
  result: { appReady: boolean } = { appReady: false };
  get name() { return 'AppKit'; }

  withReady(): void {
    this.result = { appReady: true };
  }
  defaultCallback = () => this.withReady();
}

// --- Pattern B: execute hook with typed handle ---
//
// The execute handle is merged ONTO THE RUNNER (not onto result) via Object.assign.
// AppRunnerWithExtraMethods<..., Handle> intersects Handle into the runner type,
// so runner.request is typed without any cast.
describe('createBaseTestRunner — express-like runner with execute handle (Pattern B)', () => {
  it('Handle flows through to runner — typed access without cast', async () => {
    const runner = createBaseTestRunner(
      [AppKit],
      undefined,
      async function () {
        return {
          request: {
            get: async (path: string): Promise<{ status: number }> => {
              // Simulate a request
              return { status: path === '/health' ? 200 : 404 };
            },
          },
        };
      },
    );

    runner.withReady();
    await runner.run();

    // Handle properties are on the runner (merged via Object.assign), not on result.
    // AppRunnerWithExtraMethods<..., Handle> intersects Handle into the runner type.
    const resp = await runner.request.get('/health');
    const status: number = resp.status;

    expect(status).toBe(200);
  });

  it('non-matching path returns 404', async () => {
    const runner = createBaseTestRunner(
      [AppKit],
      undefined,
      async function () {
        return {
          request: {
            get: async (path: string): Promise<{ status: number }> => {
              return { status: path === '/health' ? 200 : 404 };
            },
          },
        };
      },
    );

    runner.withReady();
    await runner.run();

    const resp = await runner.request.get('/unknown');
    expect(resp.status).toBe(404);
  });
});
