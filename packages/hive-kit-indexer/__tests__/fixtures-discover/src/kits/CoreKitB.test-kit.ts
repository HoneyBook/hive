import { TestKit } from "@honeybook/hive";

export class CoreKitB extends TestKit {
  result: { seeded: boolean } = { seeded: false };

  get name(): "CoreKitB" {
    return "CoreKitB";
  }

  withSeed(): void {
    this.result.seeded = true;
  }
}
