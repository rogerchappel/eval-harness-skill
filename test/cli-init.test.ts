import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const repository = new URL("..", import.meta.url);

function init(type: string, directory: string) {
  return spawnSync(
    process.execPath,
    ["bin/eval-harness.js", "init", "--type", type, "--dir", directory],
    { cwd: repository, encoding: "utf8" }
  );
}

describe("eval-harness init", () => {
  it("creates distinct cli and lib samples", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-init-"));
    const cliDirectory = join(root, "cli");
    const libDirectory = join(root, "lib");

    const cliResult = init("cli", cliDirectory);
    const libResult = init("lib", libDirectory);

    assert.equal(cliResult.status, 0, cliResult.stderr);
    assert.equal(libResult.status, 0, libResult.stderr);
    assert.match(readFileSync(join(cliDirectory, "sample.yaml"), "utf8"), /command: echo/);
    assert.match(readFileSync(join(libDirectory, "sample.yaml"), "utf8"), /command: node -e/);
  });

  it("rejects unsupported types without creating a directory", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-init-"));
    const directory = join(root, "unsupported");
    const result = init("nonsense", directory);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported eval type "nonsense".*Expected cli or lib/);
    assert.equal(existsSync(directory), false);
  });

  it("initializes an existing empty directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "eval-harness-init-"));
    const result = init("cli", directory);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Initialized eval suite/);
    assert.match(readFileSync(join(directory, "sample.yaml"), "utf8"), /command: echo/);
  });

  it("preserves files in an existing populated directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "eval-harness-init-"));
    const existingFile = join(directory, "notes.txt");
    writeFileSync(existingFile, "keep me\n");

    const result = init("lib", directory);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(existingFile, "utf8"), "keep me\n");
    assert.match(readFileSync(join(directory, "sample.yaml"), "utf8"), /command: node -e/);
  });

  it("refuses to overwrite an existing sample", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-init-"));
    const directory = join(root, "existing");
    const sample = join(directory, "sample.yaml");
    mkdirSync(directory);
    writeFileSync(sample, "custom: content\n");

    const result = init("cli", directory);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Refusing to overwrite existing file.*sample\.yaml/);
    assert.equal(readFileSync(sample, "utf8"), "custom: content\n");
  });
});
