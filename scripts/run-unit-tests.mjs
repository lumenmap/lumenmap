#!/usr/bin/env node
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "scripts/.test-out");
const require = createRequire(import.meta.url);
const esbuild = require("esbuild");

function collectTestSources(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      files.push(...collectTestSources(full));
      continue;
    }
    if (entry.name.endsWith(".test.ts")) files.push(full);
  }
  return files;
}

function collectBundled(dir) {
  return readdirSync(dir, { recursive: true })
    .map((name) => String(name))
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => join(dir, name));
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const tests = collectTestSources(join(root, "lib"));
if (tests.length === 0) {
  console.error("No *.test.ts files found under lib/");
  process.exit(1);
}

const entryPoints = Object.fromEntries(
  tests.map((file) => {
    const rel = relative(join(root, "lib"), file).replace(/\.test\.ts$/, ".test");
    return [rel, file];
  }),
);

await esbuild.build({
  entryPoints,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  alias: { "@": root },
  outdir: outDir,
  outExtension: { ".js": ".mjs" },
});

const files = collectBundled(outDir);
const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
