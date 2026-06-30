import { TestKit } from '@honeybook/hive';
import type { CombinedTestKitsResult } from '@honeybook/hive';
import { createBaseTestRunner } from '@honeybook/hive-runner';
import type { RunnerFactory, NoMethods } from '@honeybook/hive-runner';
import { Worker } from '@temporalio/worker';
import { MockActivityEnvironment } from '@temporalio/testing';
import type { TestWorkflowEnvironment } from '@temporalio/testing';
import { TemporalTestKit } from './TemporalTestKit';
import { TemporalConfigTestKit } from './TemporalConfigTestKit';

export const TEMPORAL_BASE_KITS = [TemporalTestKit, TemporalConfigTestKit] as const;
export type TemporalBaseKits = typeof TEMPORAL_BASE_KITS;

export type TemporalHandle = {
  testEnv: TestWorkflowEnvironment;
  client: TestWorkflowEnvironment['client']; // full SDK surface (runner.client.workflow, runner.client.schedule, etc.)
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

      const workflowsPath = cfg.workflowsPath;
      const childWorkflowsPath = cfg.childWorkflowsPath;

      const taskQueue = `${prefix}-${++runnerCounter}`;

      let childTaskQueue: string | undefined;
      if (childWorkflowsPath) {
        childTaskQueue = `${prefix}-child-${++runnerCounter}`;
      }

      if (workflowsPath) {
        const testActivities = cfg.activities ?? {};
        // Auto-inject resolveTaskQueue when child workflows are in use; test-supplied
        // activities take precedence (spread after the default).
        const mainActivities = childTaskQueue
          ? { resolveTaskQueue: async () => childTaskQueue as string, ...testActivities }
          : testActivities;
        const worker = await Worker.create({
          connection: testEnv.nativeConnection,
          taskQueue,
          namespace: 'default',
          workflowsPath,
          activities: mainActivities,
        });
        void worker.run().catch(console.error);
        afterAll(() => worker.shutdown());
      }

      if (childWorkflowsPath && childTaskQueue) {
        const childWorker = await Worker.create({
          connection: testEnv.nativeConnection,
          taskQueue: childTaskQueue,
          namespace: 'default',
          workflowsPath: childWorkflowsPath,
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
            workflowExecution: { workflowId: 'test-wf', runId: 'test-run' },
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
