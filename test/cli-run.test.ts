import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  it("reports non-object YAML and JSON inputs without TypeError stack traces", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));

    for (const [name, content] of [["null.yaml", "null\n"], ["array.json", "[]"]]) {
      const file = join(root, name);
      writeFileSync(file, content);
      const result = run([file]);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(`${name}: eval case must be an object`));
      assert.doesNotMatch(result.stderr, /TypeError/);
    }
  });

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

  it("rejects duplicate IDs before executing any suite command", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const nested = join(root, "nested");
    const marker = join(root, "executed");
    mkdirSync(nested);
    const duplicate = {
      id: "duplicate",
      name: "duplicate",
      category: "cli",
      command: `${process.execPath} -e "require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')"`,
      expect: { type: "exact", value: "" }
    };
    writeFileSync(join(root, "first.json"), JSON.stringify(duplicate));
    writeFileSync(join(nested, "second.json"), JSON.stringify(duplicate));

    const result = run([root]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Duplicate eval ID "duplicate"/);
    assert.equal(existsSync(marker), false);
  });

  it("rejects malformed case schemas before executing any command", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const marker = join(root, "executed");
    const command = `${process.execPath} -e "require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')"`;
    const malformedCases = [
      { ...evalCase("numeric-command"), command: 42 },
      { ...evalCase("invalid-expect-value"), command, expect: { type: "contains", value: false } },
      { ...evalCase("invalid-schema-value"), command, expect: { type: "schema", value: [] } }
    ];

    for (const [index, malformed] of malformedCases.entries()) {
      const file = join(root, `malformed-${index}.json`);
      writeFileSync(file, JSON.stringify(malformed));
      const result = run([file]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(`malformed-${index}\\.json`));
      assert.equal(existsSync(marker), false);
    }
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

  it("keeps user-controlled Markdown content inside four-cell result rows", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    const report = join(root, "report.md");
    writeFileSync(input, JSON.stringify({
      ...evalCase("markdown-safe"),
      name: "alpha | beta\nnext",
      category: "format | markdown"
    }));

    const result = run([input, "--format", "markdown", "--report", report]);
    assert.equal(result.status, 0, result.stderr);
    const markdown = readFileSync(report, "utf8");
    const rows = markdown.split("\n").filter((line) => /(?:✅|❌|⚠️|⊘) (?:pass|fail|error|skip)/.test(line));
    assert(rows.every((row) => row.split(/(?<!\\)\|/).length === 6), markdown);
    assert.match(markdown, /alpha \\| beta<br>next/);
    assert.match(markdown, /format \\| markdown/);
  });

  it("keeps JSON reports usable for previous-report regression comparison", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    const previous = join(root, "previous.json");
    writeFileSync(input, JSON.stringify({
      ...evalCase("regression"),
      name: "regression | name",
      category: "category | markdown"
    }));

    const baseline = run([input, "--format", "json", "--report", previous]);
    assert.equal(baseline.status, 0, baseline.stderr);

    writeFileSync(input, JSON.stringify({
      ...evalCase("regression", "different"),
      name: "regression | name",
      category: "category | markdown"
    }));
    const comparison = run([
      input,
      "--previous-report",
      previous,
      "--format",
      "markdown"
    ]);
    assert.equal(comparison.status, 1, comparison.stderr);
    assert.match(comparison.stdout, /Regressions/);
    assert.match(comparison.stdout, /regression \\| name/);
    assert.match(comparison.stdout, /category \\| markdown/);
  });

  it("creates missing parent directories for report files", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    const report = join(root, "reports", "nested", "report.json");
    writeFileSync(input, JSON.stringify(evalCase("nested-report")));

    const result = run([input, "--format", "json", "--report", report]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(readFileSync(report, "utf8")).passed, 1);
  });

  it("rejects report paths that would overwrite an eval case before execution", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const nested = join(root, "nested");
    const marker = join(root, "executed");
    mkdirSync(nested);
    const input = join(root, "case.json");
    const otherCase = join(nested, "other.json");
    const definition = evalCase("protected");
    definition.command = `${process.execPath} -e "require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')"`;
    writeFileSync(input, JSON.stringify(definition));
    writeFileSync(otherCase, JSON.stringify(evalCase("other")));

    for (const report of [input, otherCase]) {
      const result = run([report === input ? input : root, "--report", report]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Report path .* eval case/);
      assert.equal(existsSync(marker), false);
    }
  });

  it("rejects reports inside recursively scanned suites on every run", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const nested = join(root, "artifacts");
    const marker = join(root, "executed");
    mkdirSync(nested);
    const definition = evalCase("recursive-report");
    definition.command = `${process.execPath} -e "require('node:fs').writeFileSync(${JSON.stringify(marker)}, '')"`;
    writeFileSync(join(root, "case.json"), JSON.stringify(definition));
    const report = join(nested, "report.json");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = run([root, "--format", "json", "--report", report]);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Report path must be outside the eval suite/);
      assert.equal(existsSync(report), false);
      assert.equal(existsSync(marker), false);
    }
  });

  it("rejects unknown report formats", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));
    const input = join(root, "case.json");
    writeFileSync(input, JSON.stringify(evalCase("format")));

    const result = run([input, "--format", "xml"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unsupported report format "xml"/);
  });

  it("rejects partial and non-finite threshold output", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-cli-"));

    for (const [name, output] of [["partial", "42oops"], ["non-finite", "Infinity"]]) {
      const input = join(root, `${name}.json`);
      writeFileSync(input, JSON.stringify({
        id: name,
        name,
        category: "cli",
        command: `${process.execPath} -e "console.log('${output}')"`,
        expect: { type: "threshold", threshold: 40, comparator: "gte" }
      }));

      const result = run([input]);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /Cannot parse finite numeric value/);
    }
  });
});
