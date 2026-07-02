import { FlowKit } from "../kits/FlowKit.test-kit";
import { createCxTestRunner } from "./cx.test-runner";

export const FLOW_EXTRA_KITS = [FlowKit] as const;

// Deepest real layer in the ground-truth chain has no combined "total
// kits" const at all — it just passes its own increment straight into the
// wrapped call. Reproduces FlowPaymentWrapper.test-app-runner.tsx's shape.
export function createFlowTestRunner(): unknown {
  return createCxTestRunner(FLOW_EXTRA_KITS);
}
