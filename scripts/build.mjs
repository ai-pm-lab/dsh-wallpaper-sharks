/**
 * Bundles src/client.tsx (+ vendored ascii-sharks) into the DSH client-plugin
 * envelope expected by window.__ModuleLoader__.load({ id, factory }).
 *
 * Requires `npx esbuild` (run with a writable npm cache).
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cache = process.env.npm_config_cache || "/tmp/npmcache-build";
const outBundle = join(root, "lib", "_bundle.cjs");

execFileSync(
  "npx",
  [
    "--yes",
    "esbuild@0.24.0",
    "src/client.tsx",
    "--bundle",
    "--format=cjs",
    "--platform=neutral",
    "--target=es2022",
    "--jsx=automatic",
    "--external:react",
    "--external:react/jsx-runtime",
    "--outfile=lib/_bundle.cjs",
  ],
  { cwd: root, stdio: "inherit", env: { ...process.env, npm_config_cache: cache } },
);

const bundle = readFileSync(outBundle, "utf8");
const wrapped = `window.__ModuleLoader__.load({
  id: "dsh-wallpaper-sharks",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${bundle}
    return module.exports;
  }
});
`;
writeFileSync(join(root, "lib", "client.js"), wrapped);
rmSync(outBundle, { force: true });
console.log(`built lib/client.js (${wrapped.length} bytes)`);
