import { mergeTestKits, TestKit } from "@honeybook/hive";
import type { TestKitClasses } from "@honeybook/hive";
import { createBaseTestRunner } from "../src/createBaseTestRunner";
import type { RunnerFactory, NoMethods, AppRunnerWithExtraMethods } from "../src/types";
import type { MergeTestKits } from "@honeybook/hive";

// --- Test kits ---
class RequestConfigLikeKit extends TestKit {
  result: { app?: string; headers: Record<string, string> } = { headers: {} };
  get name() {
    return "RequestConfigLikeKit";
  }
  withApp(app: string): void {
    this.result.app = app;
  }
  withHeaders(h: Record<string, string>): void {
    this.result.headers = { ...this.result.headers, ...h };
  }
}

class MongoLikeKit extends TestKit {
  result: { seeded: boolean } = { seeded: false };
  get name() {
    return "MongoLikeKit";
  }
  withSeed(): void {
    this.result.seeded = true;
  }
}

class AuthLikeKit extends TestKit {
  result: { userId?: string } = {};
  get name() {
    return "AuthLikeKit";
  }
  withUser(id: string): void {
    this.result.userId = id;
  }
}

// --- Pattern C: wrapper-of-wrapper, calling chainable with* methods FROM WITHIN a
// still-generic wrapper body — this is the atlas createServiceTestRunner shape:
// a "platform-like" factory (PlatformBaseKits = [RequestConfigLikeKit]) wrapped by
// a "service-like" factory (ServiceBaseKits = [MongoLikeKit, AuthLikeKit]) that is
// itself still generic over caller-supplied ExtraKits when it calls the platform
// factory's own with* methods on its own return value.
const PLATFORM_BASE_KITS = [RequestConfigLikeKit] as const;
type PlatformBaseKits = typeof PLATFORM_BASE_KITS;

const createPlatformLikeRunner: RunnerFactory<
  PlatformBaseKits,
  Record<never, never>,
  NoMethods,
  never
> = <KitsClasses extends TestKitClasses>(kits: KitsClasses, extraMethods?: any) => {
  const allKits = [RequestConfigLikeKit, ...kits];
  return createBaseTestRunner(allKits, extraMethods) as any;
};

const SERVICE_BASE_KITS = [MongoLikeKit, AuthLikeKit] as const;

function createServiceLikeRunner<ExtraKits extends TestKitClasses = readonly []>(
  extraKits: ExtraKits = [] as unknown as ExtraKits,
) {
  const kits = mergeTestKits(SERVICE_BASE_KITS, extraKits);
  const runner: AppRunnerWithExtraMethods<
    MergeTestKits<[PlatformBaseKits, typeof kits]>,
    Record<never, never>
  > = createPlatformLikeRunner(kits) as any;

  // Called INSIDE this still-generic function body — ExtraKits is not yet resolved
  // to a concrete type here. This is exactly the case that broke before the fix.
  runner.withApp("seeded-from-inside-wrapper");
  runner.withSeed();
  runner.withUser("seeded-user");

  return runner;
}

describe("wrapper-of-wrapper runner (Pattern C) — with* methods callable inside a still-generic body", () => {
  it("base-kit methods called inside the wrapper's own generic body are seeded correctly", async () => {
    const runner = createServiceLikeRunner();
    const result = await runner.run();

    expect(result.app).toBe("seeded-from-inside-wrapper");
    expect(result.seeded).toBe(true);
    expect(result.userId).toBe("seeded-user");
  });

  it("caller-supplied extraKits still compose correctly at the concrete call site", async () => {
    class ExtraKit extends TestKit {
      result: { extra: true } = { extra: true };
      get name() {
        return "ExtraKit";
      }
    }

    const runner = createServiceLikeRunner([ExtraKit] as const);
    const result = await runner.run();

    expect(result.app).toBe("seeded-from-inside-wrapper");
    expect(result.seeded).toBe(true);
    expect(result.userId).toBe("seeded-user");
    expect(result.extra).toBe(true);
  });
});
