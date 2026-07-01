import { TestKit } from "@honeybook/hive";
import { queries as defaultQueries } from "@testing-library/react";
import type { Queries, RenderResult } from "@testing-library/react";

export class ReactTestKit extends TestKit {
  // Initialized empty; seeded by render/renderComponent/renderHook before returning.
  // RenderResult is always present when accessed after any render call.
  result = {} as RenderResult;
  get name() {
    return "ReactTestKit" as const;
  }
  defaultCallback = () => {};

  seedRenderResult(rtlResult: RenderResult): void {
    Object.assign(this.result, rtlResult);
  }
}

export class ReactTestKitWithQueries<Q extends Queries = typeof defaultQueries> extends TestKit {
  // result is typed as RenderResult<Q>; Object.assign seeds it before any test accesses it.
  result = {} as RenderResult<Q>;
  get name() {
    return "ReactTestKitWithQueries" as const;
  }
  defaultCallback = () => {};

  seedRenderResult(rtlResult: RenderResult<Q>): void {
    Object.assign(this.result, rtlResult);
  }
}
