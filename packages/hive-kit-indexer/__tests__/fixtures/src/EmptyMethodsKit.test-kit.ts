import { TestKit } from "@honeybook/hive";

export interface EmptyMethodsKitResult {
  seeded: boolean;
}

export class EmptyMethodsKit extends TestKit {
  result: EmptyMethodsKitResult = { seeded: false };

  defaultCallback = (): void => {};

  get name(): "EmptyMethodsKit" {
    return "EmptyMethodsKit";
  }

  // Not with*-prefixed (mirrors seedRenderResult) — must be excluded from
  // methods[], and the kit must still be emitted with methods: [] rather
  // than omitted.
  seedDirectly(value: boolean): void {
    this.result.seeded = value;
  }
}
