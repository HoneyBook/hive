import { TestKit } from "@honeybook/hive";

// Referenced by no runner and exported nowhere — must still appear in
// kits[] when glob-discovered, proving discovery doesn't depend on a
// runner referencing the kit or the entry point re-exporting it.
export class ScatteredKit extends TestKit {
  result: { seeded: boolean } = { seeded: false };

  get name(): "ScatteredKit" {
    return "ScatteredKit";
  }

  withSeed(): void {
    this.result.seeded = true;
  }
}
