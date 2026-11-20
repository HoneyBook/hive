import { configureTemporalTestHooks, registerHook } from "../src/hooks";

describe("registerHook", () => {
  const g = global as Record<string, unknown>;

  it("uses explicitly configured hook functions when globals are absent", () => {
    const saved = g.beforeAll;
    delete g.beforeAll;
    try {
      const calls: string[] = [];
      // Deferred: no hook yet, non-strict registration does not throw.
      registerHook("beforeAll", () => {}, 5);
      configureTemporalTestHooks({
        beforeAll: (_fn, timeout) => {
          calls.push(`beforeAll:${timeout}`);
        },
      });
      expect(calls).toEqual(["beforeAll:5"]);

      // Subsequent registrations go straight to the configured function.
      registerHook("beforeAll", () => {}, 7, true);
      expect(calls).toEqual(["beforeAll:5", "beforeAll:7"]);
    } finally {
      g.beforeAll = saved;
      configureTemporalTestHooks({ beforeAll: undefined });
    }
  });

  it("throws a clear error for a strict registration with no hook available", () => {
    const saved = g.beforeEach;
    delete g.beforeEach;
    try {
      expect(() => registerHook("beforeEach", () => {}, undefined, true)).toThrow(
        /configureTemporalTestHooks/,
      );
    } finally {
      g.beforeEach = saved;
    }
  });
});
