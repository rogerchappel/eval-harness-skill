#!/usr/bin/env node
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const repository = path.resolve(__dirname, "..");
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "eval-harness-package-"));
const installRoot = path.join(sandbox, "install");
const projectRoot = path.join(sandbox, "project");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repository,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...options,
  });

  assert.equal(
    result.status,
    0,
    [`$ ${command} ${args.join(" ")}`, result.stdout, result.stderr].filter(Boolean).join("\n")
  );
  return result;
}

try {
  fs.mkdirSync(installRoot, { recursive: true });
  fs.mkdirSync(projectRoot, { recursive: true });

  const pack = run("npm", ["pack", "--json", "--pack-destination", sandbox]);
  const [{ filename }] = JSON.parse(pack.stdout);
  const tarball = path.join(sandbox, filename);

  run("npm", ["init", "--yes"], { cwd: installRoot });
  run("npm", ["install", "--ignore-scripts", tarball], { cwd: installRoot });

  const installedSkill = fs.readFileSync(
    path.join(installRoot, "node_modules", "eval-harness-skill", "SKILL.md"),
    "utf8"
  );
  assert.match(installedSkill, /`init` creates its sample suite at `--dir`/);
  assert.match(installedSkill, /writes the formatted report at `--report`/);
  assert.match(installedSkill, /any filesystem or network side effects available to that user/);
  assert.match(installedSkill, /The harness itself makes no network calls/);

  const executable = path.join(
    installRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "eval-harness.cmd" : "eval-harness"
  );
  const cli = (args) => run(executable, args, { cwd: projectRoot });

  assert.match(cli(["--help"]).stdout, /Usage: eval-harness/);
  assert.match(cli(["init", "--type", "cli"]).stdout, /Initialized eval suite/);
  assert.equal(fs.existsSync(path.join(projectRoot, "evals", "sample.yaml")), true);
  assert.match(cli(["run", "evals"]).stdout, /Passed:\s+1/);
  assert.match(cli(["smoke"]).stdout, /Smoke test passed/);

  console.log("Packed installation smoke test passed");
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true });
}
