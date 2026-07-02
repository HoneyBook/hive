import { SeederKit } from "./SeederKit.test-kit";

export const FIXTURE_BASE_KITS = [SeederKit] as const;
export type FixtureBaseKits = typeof FIXTURE_BASE_KITS;

export function createFixtureTestRunner(): { kits: FixtureBaseKits } {
  return { kits: FIXTURE_BASE_KITS };
}
