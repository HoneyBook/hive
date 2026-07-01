import { proxyActivities, executeChild } from "@temporalio/workflow";

interface GreetingActivities {
  greet(name: string): Promise<string>;
}

interface TaskQueueActivities {
  resolveTaskQueue(): Promise<string>;
}

const { greet } = proxyActivities<GreetingActivities>({ startToCloseTimeout: "5 seconds" });
const { resolveTaskQueue } = proxyActivities<TaskQueueActivities>({
  startToCloseTimeout: "5 seconds",
});

// No activities — returns its input unchanged.
export async function echoWorkflow(value: string): Promise<string> {
  return value;
}

// Calls the greet activity registered via withActivities.
export async function greetingWorkflow(name: string): Promise<string> {
  return await greet(name);
}

// Calls the child workflow on the task queue returned by the auto-injected resolveTaskQueue.
export async function parentWorkflow(name: string): Promise<string> {
  const childQueue = await resolveTaskQueue();
  return String(
    await executeChild("childWorkflow", {
      taskQueue: childQueue,
      args: [name],
    }),
  );
}

// Runs on the child task queue.
export async function childWorkflow(name: string): Promise<string> {
  return `Child says: Hello, ${name}!`;
}
