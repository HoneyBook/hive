export type IMockAdapter<T = object> = T & { reset(): void };
export type SpyFn = (obj: object, key: string) => unknown;
