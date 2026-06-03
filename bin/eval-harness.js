#!/usr/bin/env node
// eval-harness CLI wrapper — loads TypeScript via tsx for dev, compiled JS for prod

try {
  // Try loading compiled JS first
  require("../dist/cli.js");
} catch {
  // Fall back to tsx execution (dev mode)
  require("tsx").run(["src/cli.ts"]);
}
