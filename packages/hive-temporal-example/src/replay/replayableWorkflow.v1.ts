import { proxyActivities } from "@temporalio/workflow";

const { greet } = proxyActivities<{ greet(name: string): Promise<string> }>({
  startToCloseTimeout: "5 seconds",
});

// v1 of the replay fixture: records a single activity command.
export async function replayableWorkflow(name: string): Promise<string> {
  return await greet(name);
}
