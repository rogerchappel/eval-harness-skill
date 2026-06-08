#!/usr/bin/env node
// eval-harness CLI wrapper. Uses compiled JS when present, otherwise dev-runs TS with tsx.

try {
  require("../dist/cli.js");
} catch (error) {
  const { spawnSync } = require("child_process");
  const path = require("path");

  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", path.join(__dirname, "..", "src", "cli.ts"), ...process.argv.slice(2)],
    { stdio: "inherit" }
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}
