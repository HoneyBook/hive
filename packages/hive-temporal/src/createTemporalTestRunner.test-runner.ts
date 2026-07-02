import { TestKit } from "@honeybook/hive";
import type { CombinedTestKitsResult } from "@honeybook/hive";
import { createBaseTestRunner } from "@honeybook/hive-runner";
import type { RunnerFactory, NoMethods } from "@honeybook/hive-runner";
import { Worker } from "@temporalio/worker";
import { MockActivityEnvironment } from "@temporalio/testing";
import type { TestWorkflowEnvironment } from "@temporalio/testing";
import { TemporalTestKit } from "./TemporalTestKit.test-kit";
import { TemporalConfigTestKit } from "./TemporalConfigTestKit.test-kit";

export const TEMPORAL_BASE_KITS = [TemporalTestKit, TemporalConfigTestKit] as const;
export type TemporalBaseKits = typeof TEMPORAL_BASE_KITS;

export type TemporalHandle = {
  testEnv: TestWorkflowEnvironment;
  client: TestWorkflowEnvironment["client"]; // full SDK surface (runner.client.workflow, runner.client.schedule, etc.)
  taskQueue: string;
  childTaskQueue: string | undefined;
  executeActivity: <F extends (input: any) => Promise<any>>(
    fn: F,
    input: Parameters<F>[0],
  ) => Promise<Awaited<ReturnType<F>>>;
};

export type TemporalRunnerConfig = {
  injectClients?: (handle: TemporalHandle) => void | Promise<void>;
  onReset?: () => void;
};

// Module-scoped counter — unique task queue per runner so multiple per-test
// runners sharing one TestWorkflowEnvironment never collide.
let runnerCounter = 0;

type ExecuteThis = {
  run(): Promise<void>;
  testKits: TestKit[];
  testKitsMap: {
    TemporalTestKit: TemporalTestKit;
    TemporalConfigTestKit: TemporalConfigTestKit;
  } & Record<string, TestKit>;
  result: CombinedTestKitsResult<InstanceType<TemporalBaseKits[number]>[]>;
};

export const createTemporalTestRunner: RunnerFactory<
  TemporalBaseKits,
  TemporalHandle,
  NoMethods,
  TemporalRunnerConfig
> = (kits, extraMethods, config) => {
  const allKits = [TemporalTestKit, TemporalConfigTestKit, ...kits];

  // onReset auto-registered at construction time via jest beforeEach global.
  if (config?.onReset) {
    beforeEach(config.onReset);
  }

  // Object-literal context is required for ThisType<> to apply contextual this-typing
  // to the method body. Standalone function expressions do not benefit from ThisType<>.
  const executeHolder: { execute(): Promise<TemporalHandle> } & ThisType<ExecuteThis> = {
    async execute() {
      const testEnv = this.testKitsMap.TemporalTestKit.result.testEnv;
      const cfg = this.testKitsMap.TemporalConfigTestKit.result;
      const prefix = cfg.taskQueuePrefix;

      // Worker creation is triggered by either a path (bundled at runtime) or a
      // pre-compiled bundle (via withWorkflowBundle — faster, recommended for tests).
      const hasMain = cfg.workflowsPath != null || cfg.workflowBundle != null;
      const hasChild = cfg.childWorkflowsPath != null || cfg.childWorkflowBundle != null;

      const taskQueue = `${prefix}-${++runnerCounter}`;

      let childTaskQueue: string | undefined;
      if (hasChild) {
        childTaskQueue = `${prefix}-child-${++runnerCounter}`;
      }

      if (hasMain) {
        const testActivities = cfg.activities ?? {};
        // Auto-inject resolveTaskQueue when child workflows are in use; test-supplied
        // activities take precedence (spread after the default).
        const mainActivities = childTaskQueue
          ? { resolveTaskQueue: async () => childTaskQueue as string, ...testActivities }
          : testActivities;
        const mainWorkerConfig = cfg.workflowBundle
          ? { workflowBundle: cfg.workflowBundle }
          : { workflowsPath: cfg.workflowsPath! };
        const worker = await Worker.create({
          connection: testEnv.nativeConnection,
          taskQueue,
          namespace: "default",
          ...mainWorkerConfig,
          activities: mainActivities,
        });
        void worker.run().catch(console.error);
        afterAll(() => worker.shutdown());
      }

      if (hasChild && childTaskQueue) {
        // childWorkflowBundle takes precedence; falls back to childWorkflowsPath.
        const childWorkerConfig = cfg.childWorkflowBundle
          ? { workflowBundle: cfg.childWorkflowBundle }
          : { workflowsPath: cfg.childWorkflowsPath! };
        const childWorker = await Worker.create({
          connection: testEnv.nativeConnection,
          taskQueue: childTaskQueue,
          namespace: "default",
          ...childWorkerConfig,
          activities: {},
        });
        void childWorker.run().catch(console.error);
        afterAll(() => childWorker.shutdown());
      }

      const handle: TemporalHandle = {
        testEnv,
        client: testEnv.client,
        taskQueue,
        childTaskQueue,
        executeActivity: <F extends (input: any) => Promise<any>>(
          fn: F,
          input: Parameters<F>[0],
        ) => {
          const env = new MockActivityEnvironment({
            workflowExecution: { workflowId: "test-wf", runId: "test-run" },
          });
          return env.run(fn, input) as Promise<Awaited<ReturnType<F>>>;
        },
      };

      // injectClients runs after workers start, before returning the handle.
      if (config?.injectClients) {
        await config.injectClients(handle);
      }

      return handle;
    },
  };

  return createBaseTestRunner(allKits, extraMethods as any, executeHolder.execute as any) as any;
};
