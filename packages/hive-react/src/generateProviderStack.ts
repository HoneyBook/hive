import React from "react";
import { TestKit } from "@honeybook/hive";
import type { IProviderTestKit } from "./IProviderTestKit";
import type { RenderOptions } from "@testing-library/react";

type Wrapper = NonNullable<RenderOptions["wrapper"]>;

/**
 * Composes a React provider stack from an array of test kits.
 * Kits that implement IProviderTestKit (duck-typed: 'Provider' in kit) are included.
 * Array order: first kit = outermost provider (mirrors hb-react runner.tsx:93-99).
 */
export function generateProviderStack(kits: TestKit[]): Wrapper {
  const providers = kits.filter((kit): kit is TestKit & IProviderTestKit => "Provider" in kit);

  const ProviderStack: Wrapper = ({ children }) =>
    providers.reduceRight<React.ReactElement>(
      (acc, kit) => {
        const Component = kit.Provider();
        return React.createElement(Component, null, acc);
      },
      React.createElement(React.Fragment, null, children),
    );

  return ProviderStack;
}
