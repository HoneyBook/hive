import { TestKit } from "@honeybook/hive";

export class FlowKit extends TestKit {
  result: { seeded: boolean } = { seeded: false };

  get name(): "FlowKit" {
    return "FlowKit";
  }

  withSeed(): void {
    this.result.seeded = true;
  }
}
