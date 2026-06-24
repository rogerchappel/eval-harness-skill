#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredFiles = [
  "bin",
  "dist",
  "fixtures",
  "scripts",
  "docs",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "SKILL.md",
];
const requiredScripts = ["build", "test", "check", "smoke", "lint", "package:smoke", "release:check"];
const missingFiles = requiredFiles.filter((file) => !pkg.files?.includes(file));
const missingScripts = requiredScripts.filter((script) => !pkg.scripts?.[script]);

if (pkg.bin?.["eval-harness"] !== "bin/eval-harness.js") {
  console.error("package.json bin must expose bin/eval-harness.js");
  process.exit(1);
}

if (pkg.repository?.url !== "git+https://github.com/rogerchappel/eval-harness-skill.git") {
  console.error("package.json repository URL is not the public GitHub repo");
  process.exit(1);
}

if (missingFiles.length) {
  console.error(`package.json files missing: ${missingFiles.join(", ")}`);
  process.exit(1);
}

if (missingScripts.length) {
  console.error(`package.json scripts missing: ${missingScripts.join(", ")}`);
  process.exit(1);
}

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
