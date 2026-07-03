import path from "node:path";
import type { Project, SourceFile } from "ts-morph";
import type { DiscoverOptions } from "./types.js";

/**
 * Resolves `discover.include`/`discover.exclude` as globs against
 * `packageDir`, independent of the target's own tsconfig `include` array —
 * that independence is the entire point of discover mode (no consumer
 * tsconfig changes required to make files "visible" to the tool).
 *
 * `Project.addSourceFilesAtPaths` accepts negated (`!`-prefixed) globs for
 * excludes, so include+exclude resolve in a single call.
 */
export function discoverSourceFiles(
  project: Project,
  packageDir: string,
  discover: DiscoverOptions,
): SourceFile[] {
  const absIncludes = discover.include.map((glob) => path.join(packageDir, glob));
  const absExcludes = (discover.exclude ?? []).map((glob) => `!${path.join(packageDir, glob)}`);

  const files = project.addSourceFilesAtPaths([...absIncludes, ...absExcludes]);

  if (files.length === 0) {
    throw new Error(
      `[hive-kit-indexer] discover.include matched no files: ${JSON.stringify(discover.include)}`,
    );
  }

  return files;
}
