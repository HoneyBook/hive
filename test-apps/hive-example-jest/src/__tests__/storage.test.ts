import { Storage } from "../storage.js";

// The jest-resolver.cjs substitutes storage.ts → __mocks__/storage.ts at resolve time.

describe("Storage (mock via __mocks__/ directory)", () => {
  let storage: InstanceType<typeof Storage>;

  beforeEach(() => {
    storage = new Storage();
  });

  it("returns the same instance (singleton)", () => {
    const a = new Storage();
    const b = new Storage();
    expect(a).toBe(b);
  });

  it("has spied save method", () => {
    storage.save("key", "val");
    expect(jest.isMockFunction(storage.save)).toBe(true);
    expect(storage.save).toHaveBeenCalledWith("key", "val");
  });

  it("spy call history cleared between tests (clearMocks: true)", () => {
    expect(storage.save).not.toHaveBeenCalled();
  });
});
