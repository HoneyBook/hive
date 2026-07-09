#!/usr/bin/env node

// multi-semantic-release rewrites internal `@honeybook/*` deps from `workspace:*`
// to a pinned literal version while preparing a release (see updateDeps.js's
// resolveNextVersion, which substitutes the workspace protocol unconditionally,
// before its own `--deps.bump=ignore` check even runs). pnpm resolves `workspace:*`
// to the correct real version at pack/publish time on its own, so nothing here
// needs the pinned literal — this restores the committed package.json to the
// repo's `workspace:*` convention right before @semantic-release/git commits it.

const fs = require("fs");
const path = require("path");

const pkgPath = path.join(process.cwd(), "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const depFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
let changed = false;

for (const field of depFields) {
  const deps = pkg[field];
  if (!deps) {
    continue;
  }
  for (const [name, version] of Object.entries(deps)) {
    if (name.startsWith("@honeybook/") && version !== "workspace:*") {
      deps[name] = "workspace:*";
      changed = true;
    }
  }
}

if (changed) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`restore-workspace-protocol: restored workspace:* refs in ${pkgPath}`);
} else {
  console.log("restore-workspace-protocol: no workspace:* refs needed restoring");
}
