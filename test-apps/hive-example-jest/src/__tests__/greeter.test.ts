import { Greeter } from "../greeter.js";

// The jest-resolver.cjs substitutes greeter.ts → greeter.mock.ts at resolve time.
// So `Greeter` here is actually the MockAdapter-wrapped class.

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
    expect(jest.isMockFunction(greeter.greet)).toBe(true);
    expect(greeter.greet).toHaveBeenCalledWith("World");
  });

  it("spy call history cleared between tests (clearMocks: true)", () => {
    expect(greeter.greet).not.toHaveBeenCalled();
  });
});
