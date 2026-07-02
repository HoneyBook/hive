import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type MockResolver = (realAbsolutePath: string) => string | null;

export function siblingMockResolver(realAbsolutePath: string): string | null {
  const match = realAbsolutePath.match(/^(.*)\.(tsx?)$/);
  if (!match) {
    return null;
  }
  const candidate = `${match[1]}.mock.${match[2]}`;
  if (existsSync(candidate)) {
    return candidate;
  }
  return null;
}

export function mocksDirResolver(realAbsolutePath: string): string | null {
  const dir = dirname(realAbsolutePath);
  const filename = realAbsolutePath.slice(dir.length + 1);
  const candidate = resolve(dir, "__mocks__", filename);
  if (existsSync(candidate)) {
    return candidate;
  }
  return null;
}

const mockSubstitutionResolver = (
  request: string,
  options: {
    basedir: string;
    defaultResolver: (req: string, opts: object) => string;
    [key: string]: unknown;
  },
): string => {
  const real = options.defaultResolver(request, options);
  if (!real.endsWith(".ts") && !real.endsWith(".tsx")) {
    return real;
  }
  const mock = siblingMockResolver(real);
  return mock ?? real;
};

export default mockSubstitutionResolver;
