// Test-framework lifecycle hooks. By default the package uses the `beforeAll` /
// `afterAll` / `beforeEach` globals (jest, or vitest with `globals: true`). Runners
// that do not expose globals (vitest with `globals: false`) can pass the functions
// explicitly via `configureTemporalTestHooks`.

type HookFn = (fn: () => void | Promise<void>, timeout?: number) => unknown;

export interface TemporalTestHooks {
  beforeAll: HookFn;
  afterAll: HookFn;
  beforeEach: HookFn;
}

let explicit: Partial<TemporalTestHooks> = {};
const pending: Array<() => void> = [];

function resolveHook(name: keyof TemporalTestHooks): HookFn | undefined {
  return explicit[name] ?? ((global as Record<string, unknown>)[name] as HookFn | undefined);
}

export function configureTemporalTestHooks(hooks: Partial<TemporalTestHooks>): void {
  explicit = { ...explicit, ...hooks };
  // Flush registrations that were deferred because no hook function existed yet.
  const queued = pending.splice(0);
  for (const register of queued) {
    register();
  }
}

// Registers now when the hook is available; otherwise defers until
// configureTemporalTestHooks supplies it (import-time registration under vitest with
// `globals: false`). `required` hooks throw if still missing when `strict` is set.
export function registerHook(
  name: keyof TemporalTestHooks,
  fn: () => void | Promise<void>,
  timeout?: number,
  strict = false,
): void {
  const hook = resolveHook(name);
  if (hook) {
    hook(fn, timeout);
    return;
  }
  if (strict) {
    throw new Error(
      `[hive-temporal] "${name}" is not available as a global. Run with jest, vitest ` +
        `\`globals: true\`, or call configureTemporalTestHooks({ beforeAll, afterAll, beforeEach }) ` +
        `with the functions imported from your test framework.`,
    );
  }
  pending.push(() => registerHook(name, fn, timeout, true));
}
