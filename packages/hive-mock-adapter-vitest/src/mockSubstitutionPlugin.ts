import type { Plugin } from "vitest/config";
import { resolve, dirname, join } from "node:path";
import { existsSync, globSync } from "node:fs";

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

export function mockSubstitutionPlugin(opts: {
  paths: string[];
  aliases?: Record<string, string>;
  resolver?: MockResolver;
}): Plugin {
  // Expand opts.paths globs to a set of absolute paths (eligibility gate)
  const cwd = process.cwd();
  const eligiblePaths = new Set<string>();
  for (const pattern of opts.paths) {
    const matches = globSync(pattern, { cwd });
    for (const m of matches) {
      // Convert .mock.ts path to real .ts path for eligibility matching
      const absPath = join(cwd, m as string);
      const realPath = absPath.replace(/\.mock\.(tsx?)$/, ".$1");
      eligiblePaths.add(realPath);
    }
  }

  const resolverFn = opts.resolver ?? siblingMockResolver;

  const plugin: Plugin = {
    name: "mock-substitution",
    enforce: "pre",
    resolveId(importee, importer) {
      if (!importer) {
        return null;
      }
      const importerDir = dirname(importer);
      const resolvedJs = resolve(importerDir, importee);
      const resolvedTs = resolvedJs.replace(/\.js$/, ".ts");
      // Only intercept files that are in the eligible set
      if (!eligiblePaths.has(resolvedTs)) {
        return null;
      }
      const mock = resolverFn(resolvedTs);
      if (mock) {
        return { id: mock };
      }
      return null;
    },
  };

  if (opts.aliases) {
    plugin.config = (config) => {
      const existingAlias = Array.isArray(config.resolve?.alias)
        ? config.resolve.alias
        : Object.entries(config.resolve?.alias ?? {}).map(([find, replacement]) => ({
            find,
            replacement,
          }));
      return {
        resolve: {
          alias: [
            ...existingAlias,
            ...Object.entries(opts.aliases!).map(([find, replacement]) => ({ find, replacement })),
          ],
        },
      };
    };
  }

  return plugin;
}
