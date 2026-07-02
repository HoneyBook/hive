import { TestKit } from "@honeybook/hive";

// `result`'s type (Date) is a TypeScript-lib global, not a package-local
// interface — must collapse to a single { field: "result", type: "Date" }.
export class ExternalResultKit extends TestKit {
  result: Date = new Date(0);

  defaultCallback = (): void => {};

  get name(): "ExternalResultKit" {
    return "ExternalResultKit";
  }

  withTimestamp(date: Date): void {
    this.result = date;
  }
}
