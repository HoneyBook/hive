import { TestKit } from '@honeybook/hive';

export interface TemporalConfigTestKitResult {
  workflowsPath: string | undefined;
  childWorkflowsPath: string | undefined;
  activities: Record<string, (...args: any[]) => any> | undefined;
  taskQueuePrefix: string;
}

export class TemporalConfigTestKit extends TestKit {
  result: TemporalConfigTestKitResult = {
    workflowsPath: undefined,
    childWorkflowsPath: undefined,
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

  withChildWorkflowsPath(path: string): void {
    this.result.childWorkflowsPath = path;
  }

  withActivities(activities: Record<string, (...args: any[]) => any>): void {
    this.result.activities = activities;
  }

  withTaskQueuePrefix(prefix: string): void {
    this.result.taskQueuePrefix = prefix;
  }
}
