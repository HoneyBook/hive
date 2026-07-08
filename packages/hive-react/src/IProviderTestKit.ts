import type React from "react";

export interface IProviderTestKit {
  Provider(): React.FC<React.PropsWithChildren<unknown>>;
}
