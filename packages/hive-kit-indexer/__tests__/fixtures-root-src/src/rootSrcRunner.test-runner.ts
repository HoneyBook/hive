import { RootSrcKit } from "./RootSrcKit.test-kit";

export const ROOT_SRC_BASE_KITS = [RootSrcKit] as const;
export type RootSrcBaseKits = typeof ROOT_SRC_BASE_KITS;

export function createRootSrcTestRunner(): { kits: RootSrcBaseKits } {
  return { kits: ROOT_SRC_BASE_KITS };
}
