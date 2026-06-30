import { describe, it, expect, beforeEach, vi } from "vitest";
import { Greeter } from "./greeter.js";

// mockSubstitutionPlugin substitutes greeter.ts → greeter.mock.ts

describe("Greeter (mock via .mock.ts sibling)", () => {
  let greeter: InstanceType<typeof Greeter>;

  beforeEach(() => {
    greeter = new Greeter();
  });

  it("returns the same instance (singleton)", () => {
    const a = new Greeter();
    const b = new Greeter();
    expect(a).toBe(b);
  });

  it("has spied greet method", () => {
    greeter.greet("World");
    expect(vi.isMockFunction(greeter.greet)).toBe(true);
    expect(greeter.greet).toHaveBeenCalledWith("World");
  });

  it("spy call history cleared between tests (clearMocks: true)", () => {
    expect(greeter.greet).not.toHaveBeenCalled();
  });
});
