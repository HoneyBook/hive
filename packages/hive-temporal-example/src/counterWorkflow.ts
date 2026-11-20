import {
  condition,
  defineQuery,
  defineSignal,
  defineUpdate,
  setHandler,
} from "@temporalio/workflow";

export const incrementSignal = defineSignal<[number]>("increment");
export const finishSignal = defineSignal("finish");
export const valueQuery = defineQuery<number>("value");
export const addUpdate = defineUpdate<number, [number]>("add");

// Long-lived workflow exposing a signal, a query and an update handler — the fixture for
// the signals / queries / updates / Update-with-Start examples.
export async function counterWorkflow(initial = 0): Promise<number> {
  let value = initial;
  let finished = false;

  setHandler(incrementSignal, (by) => {
    value += by;
  });
  setHandler(finishSignal, () => {
    finished = true;
  });
  setHandler(valueQuery, () => value);
  setHandler(addUpdate, (by) => {
    value += by;
    return value;
  });

  await condition(() => finished);
  return value;
}
