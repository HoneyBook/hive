import { proxyActivities, executeChild } from '@temporalio/workflow';

interface GreetingActivities {
  greet(name: string): Promise<string>;
}

interface TaskQueueActivities {
  resolveTaskQueue(): Promise<string>;
}

const { greet } = proxyActivities<GreetingActivities>({
  startToCloseTimeout: '5 seconds',
});

const { resolveTaskQueue } = proxyActivities<TaskQueueActivities>({
  startToCloseTimeout: '5 seconds',
});

// Simple echo — no activities, no child workflows.
export async function echoWorkflow(value: string): Promise<string> {
  return value;
}

// Calls the greet activity registered by the consumer via withActivities.
export async function greetingWorkflow(name: string): Promise<string> {
  return await greet(name);
}

// Calls a child workflow on the task queue returned by the auto-injected resolveTaskQueue activity.
export async function parentWorkflow(name: string): Promise<string> {
  const childQueue = await resolveTaskQueue();
  const result = await executeChild('childWorkflow', {
    taskQueue: childQueue,
    args: [name],
  });
  return result as string;
}

// Runs on the child task queue; returns a greeting to prove the child worker ran.
export async function childWorkflow(name: string): Promise<string> {
  return `Child says: Hello, ${name}!`;
}
