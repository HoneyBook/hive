import { defineConfig } from "vitest/config";
import { mockSubstitutionPlugin } from "@honeybook/hive-mock-adapter-vitest";

export default defineConfig({
  plugins: [mockSubstitutionPlugin({ paths: ["src/**/*.mock.ts"] })],
  test: {
    setupFiles: ["./src/setup.ts"],
    clearMocks: true,
  },
});
