// Node-only entry, published as the `./resolvers` subpath.
//
// These import `node:fs` / `node:path`, which is correct for jest config (CJS, runs in
// Node at config time) and fatal in a browser bundle. Keeping them out of the root entry
// is what lets `MockAdapter` be imported from mock adapter files that application code —
// and therefore a bundler — can reach.
export { siblingMockResolver, mocksDirResolver } from "./src/mockSubstitutionResolver.js";
export type { MockResolver } from "./src/mockSubstitutionResolver.js";
