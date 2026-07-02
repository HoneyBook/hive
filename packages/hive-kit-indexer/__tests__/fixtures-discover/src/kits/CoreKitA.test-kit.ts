import { TestKit } from "@honeybook/hive";

export class CoreKitA extends TestKit {
  result: { seeded: boolean } = { seeded: false };

  get name(): "CoreKitA" {
    return "CoreKitA";
  }

  withSeed(): void {
    this.result.seeded = true;
  }
}
