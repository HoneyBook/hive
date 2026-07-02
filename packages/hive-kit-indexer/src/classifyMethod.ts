import type { MethodDeclaration } from "ts-morph";
import type { MethodKind } from "./types";

// Only errorInjector is inferable from a name pattern; `exposure` has no
// naming convention and is reachable only via an explicit @kind tag.
const ERROR_METHOD_PATTERN = /^(with|set)[A-Z].*Error/;
const VALID_KINDS: ReadonlyArray<MethodKind> = ["seeder", "errorInjector", "exposure"];

/**
 * Classifies a with* method's kind.
 * An explicit `@kind` JSDoc tag always wins; otherwise falls back to the
 * withXError/setXError name-pattern heuristic, defaulting to "seeder".
 */
export function classifyMethodKind(method: MethodDeclaration): MethodKind {
  // Filter on a comment that's actually a valid kind value (not just tag
  // name "kind") — TS's JSDoc parser treats any "@word" occurring anywhere
  // in a comment's prose as a tag start, so a description that happens to
  // mention "@kind" in passing would otherwise produce a spurious match.
  const validKindTags = method
    .getJsDocs()
    .flatMap((doc) => doc.getTags())
    .filter((tag) => tag.getTagName() === "kind")
    .map((tag) => tag.getCommentText()?.trim())
    .filter((value): value is MethodKind =>
      (VALID_KINDS as readonly string[]).includes(value ?? ""),
    );

  if (validKindTags.length > 0) {
    return validKindTags[validKindTags.length - 1];
  }

  if (ERROR_METHOD_PATTERN.test(method.getName())) {
    return "errorInjector";
  }

  return "seeder";
}

/** Returns the method's JSDoc description text, or null when absent/empty. */
export function getMethodJsDoc(method: MethodDeclaration): string | null {
  const docs = method.getJsDocs();
  if (docs.length === 0) {
    return null;
  }
  const description = docs[docs.length - 1].getDescription().trim();
  return description.length > 0 ? description : null;
}
