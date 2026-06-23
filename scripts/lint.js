#!/usr/bin/env node
const { spawnSync } = require("node:child_process");

const checks = [
  ["node", ["--check", "bin/eval-harness.js"]],
  ["npx", ["tsc", "--noEmit"]],
];

for (const [command, args] of checks) {
  const label = [command, ...args].join(" ");
  console.log(`$ ${label}`);

  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
