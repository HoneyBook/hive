import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@honeybook/hive": fileURLToPath(new URL("../hive/index.ts", import.meta.url)),
      "@honeybook/hive-runner": fileURLToPath(new URL("../hive-runner/index.ts", import.meta.url)),
      "@honeybook/hive-temporal": fileURLToPath(
        new URL("../hive-temporal/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    globals: true,
    testTimeout: 120_000,
  },
});
