import { TestKit } from "@honeybook/hive";

export interface SeederKitResult {
  value: string;
  errorMessage: string | undefined;
}

export class SeederKit extends TestKit {
  result: SeederKitResult = { value: "", errorMessage: undefined };

  defaultCallback = (): void => {};

  get name(): "SeederKit" {
    return "SeederKit";
  }

  /** Seeds the value under test. */
  withValue(value: string): void {
    this.result.value = value;
  }

  // No @kind tag — name-pattern heuristic must classify this errorInjector.
  withValueError(message: string): void {
    this.result.errorMessage = message;
  }

  /**
   * Name matches the errorInjector pattern, but the explicit tag below
   * must win over the name-pattern heuristic.
   * @kind seeder
   */
  withComputedError(): void {
    this.result.errorMessage = undefined;
  }
}
