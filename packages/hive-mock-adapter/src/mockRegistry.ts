type ResetFn = () => void;
const resets: ResetFn[] = [];

export function registerReset(fn: ResetFn): void {
  resets.push(fn);
}

export function cleanupMockAdapters(): void {
  for (const fn of resets) {
    fn();
  }
}
