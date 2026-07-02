// An interface with "TestKit" in its name but no class declaration and no
// heritage clause at all — must never be flagged as a kit.
export interface IFixtureTestKit {
  someMethod(): void;
}
