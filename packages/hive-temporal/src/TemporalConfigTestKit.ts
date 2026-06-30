import { TestKit } from '@honeybook/hive';
import type { WorkflowBundle } from '@temporalio/worker';

export interface TemporalConfigTestKitResult {
  workflowsPath: string | undefined;
  workflowBundle: WorkflowBundle | undefined;
  childWorkflowsPath: string | undefined;
  childWorkflowBundle: WorkflowBundle | undefined;
  activities: Record<string, (...args: any[]) => any> | undefined;
  taskQueuePrefix: string;
}

export class TemporalConfigTestKit extends TestKit {
  result: TemporalConfigTestKitResult = {
    workflowsPath: undefined,
    workflowBundle: undefined,
    childWorkflowsPath: undefined,
    childWorkflowBundle: undefined,
    activities: undefined,
    taskQueuePrefix: 'hive-test',
  };

  defaultCallback = (): void => {};

  get name(): 'TemporalConfigTestKit' {
    return 'TemporalConfigTestKit';
  }

  withWorkflowsPath(path: string): void {
    this.result.workflowsPath = path;
  }

  withWorkflowBundle(bundle: WorkflowBundle): void {
    this.result.workflowBundle = bundle;
  }

  withChildWorkflowsPath(path: string): void {
    this.result.childWorkflowsPath = path;
  }

  withChildWorkflowBundle(bundle: WorkflowBundle): void {
    this.result.childWorkflowBundle = bundle;
  }

  withActivities(activities: Record<string, (...args: any[]) => any>): void {
    this.result.activities = activities;
  }

  withTaskQueuePrefix(prefix: string): void {
    this.result.taskQueuePrefix = prefix;
  }
}
