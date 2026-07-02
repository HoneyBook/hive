import { CoreKitA } from "../kits/CoreKitA.test-kit";
import { CoreKitB } from "../kits/CoreKitB.test-kit";
import { createBaseTestRunner } from "../_shim/primitives";

export const HB_BASE_KITS = [CoreKitA, CoreKitB] as const;

export function createHbTestRunner(extraKits: unknown[]): unknown {
  const allKits = [...HB_BASE_KITS, ...extraKits];
  return createBaseTestRunner(allKits);
}
