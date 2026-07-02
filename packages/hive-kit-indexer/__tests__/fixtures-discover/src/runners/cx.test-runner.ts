import { CxKit } from "../kits/CxKit.test-kit";
import { createHbTestRunner } from "./hbBase.test-runner";

export const CX_EXTRA_KITS = [CxKit] as const;

export function createCxTestRunner(extraKits?: readonly unknown[]): unknown {
  const all = [...CX_EXTRA_KITS, ...(extraKits ?? [])];
  return createHbTestRunner(all);
}
