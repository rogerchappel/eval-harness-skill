import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

const repository = new URL("..", import.meta.url);

function run(args: string[]) {
  return spawnSync(process.execPath, ["bin/eval-harness.js", "run", ...args], {
    cwd: repository,
    encoding: "utf8"
  });
}

function evalCase(id: string, expected = "ok") {
  return {
    id,
    name: id,
    category: "cli",
    command: `${process.execPath} -e "console.log('ok')"`,
    expect: { type: "exact", value: expected }
  };
}

describe("eval-harness run", () => {
  it("accepts YAML, YML, and JSON single-case inputs", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    for (const extension of ["yaml", "yml"]) {
      const file = join(root, `case.${extension}`);
      writeFileSync(file, [
        `id: ${extension}`,
        `name: ${extension}`,
        "category: cli",
        `command: ${process.execPath} -e "console.log('ok')"`,
        "expect:",
        "  type: exact",
        "  value: ok",
        ""
      ].join("\n"));
      const result = run([file]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Passed:\s+1/);
    }

    const jsonFile = join(root, "case.json");
    writeFileSync(jsonFile, JSON.stringify(evalCase("json")));
    const result = run([jsonFile]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Passed:\s+1/);
  });

  it("accepts recursive directory input and rejects unsupported files", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const suite = join(root, "suite.json");
    writeFileSync(suite, JSON.stringify(evalCase("directory")));

    const directoryResult = run([root]);
    assert.equal(directoryResult.status, 0, directoryResult.stderr);
    assert.match(directoryResult.stdout, /Passed:\s+1/);

    const unsupported = join(root, "case.txt");
    writeFileSync(unsupported, "not an eval");
    const unsupportedResult = run([unsupported]);
    assert.notEqual(unsupportedResult.status, 0);
    assert.match(unsupportedResult.stderr, /Unsupported eval file type "\.txt"/);
  });

  it("uses json, text, and markdown consistently for stdout and report files", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    writeFileSync(input, JSON.stringify(evalCase("formats")));

    const expectations = {
      json: /\{\s*"total":/s,
      text: /EVAL REPORT/,
      markdown: /^# Eval Report/m
    };

    for (const [format, pattern] of Object.entries(expectations)) {
      const report = join(root, `report.${format}`);
      const result = run([input, "--format", format, "--report", report]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, pattern);
      assert.match(readFileSync(report, "utf8"), pattern);
    }
  });

  it("keeps JSON reports usable for previous-report regression comparison", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    const previous = join(root, "previous.json");
    writeFileSync(input, JSON.stringify(evalCase("regression")));

    const baseline = run([input, "--format", "json", "--report", previous]);
    assert.equal(baseline.status, 0, baseline.stderr);

    writeFileSync(input, JSON.stringify(evalCase("regression", "different")));
    const comparison = run([
      input,
      "--previous-report",
      previous,
      "--format",
      "markdown"
    ]);
    assert.equal(comparison.status, 1, comparison.stderr);
    assert.match(comparison.stdout, /Regressions/);
    assert.match(comparison.stdout, /regression/);
  });

  it("rejects unknown report formats", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    writeFileSync(input, JSON.stringify(evalCase("format")));

    const result = run([input, "--format", "xml"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported report format "xml"/);
  });
});
