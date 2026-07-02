import { TestKit } from "@honeybook/hive";

export class CxKit extends TestKit {
  result: { seeded: boolean } = { seeded: false };

  get name(): "CxKit" {
    return "CxKit";
  }

  withSeed(): void {
    this.result.seeded = true;
  }
}
