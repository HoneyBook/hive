import { proxyActivities, sleep } from "@temporalio/workflow";

const { greet } = proxyActivities<{ greet(name: string): Promise<string> }>({
  startToCloseTimeout: "5 seconds",
});

// v2 of the replay fixture: a code change that adds a timer BEFORE the activity — a
// non-deterministic change for any history recorded by v1.
export async function replayableWorkflow(name: string): Promise<string> {
  await sleep("1 second");
  return await greet(name);
}
