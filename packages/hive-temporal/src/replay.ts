import { readFile } from "node:fs/promises";
import { Worker } from "@temporalio/worker";
import type { ReplayWorkerOptions, WorkflowBundle } from "@temporalio/worker";

export interface ReplayHistoryInput {
  workflowId: string;
  /** A `History` (e.g. from `handle.fetchHistory()`) or its proto-JSON form. */
  history: unknown;
}

export type ReplayWorkflowSource =
  | { workflowsPath: string; workflowBundle?: undefined }
  | { workflowBundle: WorkflowBundle; workflowsPath?: undefined };

export type ReplayHistoriesOptions = ReplayWorkflowSource &
  Omit<ReplayWorkerOptions, "workflowsPath" | "workflowBundle">;

export interface ReplayHistoriesResult {
  replayed: number;
}

async function loadHistories(
  histories: Array<ReplayHistoryInput | string>,
): Promise<ReplayHistoryInput[]> {
  return Promise.all(
    histories.map(async (entry) => {
      if (typeof entry !== "string") {
        return entry;
      }
      // History JSON files (e.g. `temporal workflow show --output json`) carry no workflow id,
      // so the file path stands in for it in error messages.
      return { workflowId: entry, history: JSON.parse(await readFile(entry, "utf8")) as unknown };
    }),
  );
}

// Replays histories against the given workflow code and throws one error naming every
// workflow id that failed and the cause (e.g. a non-determinism error).
export async function replayHistories(
  histories: Array<ReplayHistoryInput | string>,
  options: ReplayHistoriesOptions,
): Promise<ReplayHistoriesResult> {
  if (options.workflowsPath == null && options.workflowBundle == null) {
    throw new Error(
      "[hive-temporal] replayHistories requires `workflowsPath` or `workflowBundle`.",
    );
  }
  const loaded = await loadHistories(histories);
  const failures: string[] = [];
  let replayed = 0;
  for await (const result of Worker.runReplayHistories(options, loaded)) {
    replayed++;
    if (result.error) {
      failures.push(
        `workflow "${result.workflowId}" (run ${result.runId}): ${result.error.name}: ${result.error.message}`,
      );
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `[hive-temporal] replay failed for ${failures.length} of ${replayed} histories:\n${failures.join("\n")}`,
    );
  }
  return { replayed };
}
