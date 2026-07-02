import { createBTestRunner } from "./b.test-runner";

export function createATestRunner(): unknown {
  return createBTestRunner();
}
