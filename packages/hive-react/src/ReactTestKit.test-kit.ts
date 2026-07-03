import { TestKit } from "@honeybook/hive";
import { queries as defaultQueries } from "@testing-library/react";
import type { Queries, RenderResult } from "@testing-library/react";

export class ReactTestKit extends TestKit {
  // ui is empty until seeded by render/renderComponent before returning; always
  // present by the time a test accesses it. Nested under `ui` (not spread onto
  // `result` directly) — RTL's RenderResult is not itself hive-react's concept
  // of a kit result, it's the raw underlying render output.
  result: { ui: RenderResult } = { ui: {} as RenderResult };
  get name() {
    return "ReactTestKit" as const;
  }
  defaultCallback = () => {};

  seedRenderResult(rtlResult: RenderResult): void {
    this.result.ui = rtlResult;
  }
}

export class ReactTestKitWithQueries<Q extends Queries = typeof defaultQueries> extends TestKit {
  result: { ui: RenderResult<Q> } = { ui: {} as RenderResult<Q> };
  get name() {
    return "ReactTestKitWithQueries" as const;
  }
  defaultCallback = () => {};

  seedRenderResult(rtlResult: RenderResult<Q>): void {
    this.result.ui = rtlResult;
  }
}
