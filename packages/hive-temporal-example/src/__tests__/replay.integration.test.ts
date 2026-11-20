import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "url";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { bundleWorkflowCode } from "@temporalio/worker";
import type { WorkflowBundleWithSourceMap } from "@temporalio/worker";
import { createTemporalTestRunner, replayHistories } from "@honeybook/hive-temporal";
import * as activities from "../activities.js";

const entry = (name: string) => fileURLToPath(new URL(`../testing/${name}`, import.meta.url));

let v1Bundle: WorkflowBundleWithSourceMap;
let v2Bundle: WorkflowBundleWithSourceMap;
let tmp: string;
beforeAll(async () => {
  v1Bundle = await bundleWorkflowCode({ workflowsPath: entry("workflows.test-bundle.ts") });
  v2Bundle = await bundleWorkflowCode({
    workflowsPath: entry("workflows.replay-v2.test-bundle.ts"),
  });
  tmp = await mkdtemp(join(tmpdir(), "hive-replay-"));
}, 60_000);
afterAll(() => rm(tmp, { recursive: true, force: true }));

// Writes a history in the proto-JSON shape of `temporal workflow show --output json`
// (timestamps as ISO strings, durations as "<s>s"). The SDK's `historyToJSON` would do this but
// breaks with proto3-json-serializer 2.0.2
// (https://github.com/googleapis/proto3-json-serializer-nodejs/issues/103), so this fixture
// converts the two well-known types by hand.
function protoJsonReplacer(key: string, value: unknown): unknown {
  const v = value as { seconds?: unknown; nanos?: number } | null;
  if (!v || typeof v !== "object") return value;
  const isDuration = /(Timeout|Interval|Backoff|Delay|Duration)$/i.test(key);
  if (isDuration && Object.keys(v).every((k) => k === "seconds" || k === "nanos")) {
    return `${Number(v.seconds ?? 0)}.${String(v.nanos ?? 0).padStart(9, "0")}s`;
  }
  if ("seconds" in v && Object.keys(v).length <= 2) {
    return new Date(Number(v.seconds) * 1000 + Math.floor((v.nanos ?? 0) / 1e6)).toISOString();
  }
  return value;
}

async function recordHistory() {
  const runner = createTemporalTestRunner([]);
  runner.withWorkflowBundle(v1Bundle);
  runner.withActivities(activities);
  await runner.run();
  const workflowId = `replay-${runner.taskQueue}`;
  const handle = await runner.client.workflow.start("replayableWorkflow", {
    taskQueue: runner.taskQueue,
    workflowId,
    args: ["Replay"],
  });
  expect(await handle.result()).toBe("Hello, Replay!");
  return { runner, workflowId, history: await handle.fetchHistory() };
}

describe("replayHistories", () => {
  it("passes when the workflow code is unchanged (runner method, objects)", async () => {
    const { runner, workflowId, history } = await recordHistory();
    // Defaults to the runner's configured workflow bundle.
    await expect(runner.replayHistories([{ workflowId, history }])).resolves.toEqual({
      replayed: 1,
    });
  });

  it("passes for JSON history files (standalone function)", async () => {
    const { workflowId, history } = await recordHistory();
    const file = join(tmp, `${workflowId}.json`);
    await writeFile(file, JSON.stringify(history, protoJsonReplacer));
    await expect(replayHistories([file], { workflowBundle: v1Bundle })).resolves.toEqual({
      replayed: 1,
    });
  });

  it("fails after a code change, naming the workflow id and the nondeterminism cause", async () => {
    const { runner, workflowId, history } = await recordHistory();
    const failure = runner.replayHistories([{ workflowId, history }], { workflowBundle: v2Bundle });
    await expect(failure).rejects.toThrow(`workflow "${workflowId}"`);
    await expect(failure).rejects.toThrow(/nondeterminism|determinism/i);
  });
});
