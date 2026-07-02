import { TestKit } from "@honeybook/hive";

export class LocalKit extends TestKit {
  result: { seeded: boolean } = { seeded: false };

  get name(): "LocalKit" {
    return "LocalKit";
  }

  withSeed(): void {
    this.result.seeded = true;
  }
}
