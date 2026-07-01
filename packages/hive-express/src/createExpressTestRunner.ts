import { TestKit } from "@honeybook/hive";
import type { CombinedTestKitsResult } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type { RunnerFactory, NoMethods } from "@honeybook/hive-runner";
import supertest from "supertest";
import { RequestConfigTestKit } from "./RequestConfigTestKit";

export const EXPRESS_BASE_KITS = [RequestConfigTestKit] as const;
export type ExpressBaseKits = typeof EXPRESS_BASE_KITS;

type ExpressHandle = { request: ReturnType<typeof supertest.agent> };

export const createExpressTestRunner: RunnerFactory<
  ExpressBaseKits,
  ExpressHandle,
  NoMethods,
  never
> = (kits, extraMethods) => {
  const allKits = [RequestConfigTestKit, ...kits];

  type ExecuteThis = {
    run(): Promise<void>;
    testKits: TestKit[];
    testKitsMap: { RequestConfigTestKit: RequestConfigTestKit } & Record<string, TestKit>;
    result: CombinedTestKitsResult<InstanceType<ExpressBaseKits[number]>[]>;
  };

  // Object-literal context is required for ThisType<> to apply contextual this-typing
  // to the method body. Standalone function expressions do not benefit from ThisType<>.
  const executeHolder: { execute(): ExpressHandle } & ThisType<ExecuteThis> = {
    execute() {
      const kit = this.testKitsMap.RequestConfigTestKit;
      const app = kit.result.app!;
      const agent = supertest.agent(app);
      if (Object.keys(kit.result.headers).length > 0) {
        agent.set(kit.result.headers);
      }
      return { request: agent };
    },
  };

  // RunnerFactory outer annotation specialises BaseKits + ExecuteFn; createBaseTestRunner's
  // inner generics don't unify with them directly — same pattern as createReactTestRunner.
  return createBaseTestRunner(allKits, extraMethods as any, executeHolder.execute as any) as any;
};
