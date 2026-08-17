import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseCaseFile, parseEvalSuite } from "../src/parser";

const yamlCase = (id: string) => [
  `id: ${id}`,
  `name: ${id}`,
  "category: parser",
  'command: echo "ok"',
  "expect:",
  "  type: contains",
  "  value: ok",
  ""
].join("\n");

function writeThresholdCase(expectation: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
  const file = join(root, "threshold.json");
  writeFileSync(file, JSON.stringify({
    id: "threshold-case",
    name: "threshold-case",
    category: "parser",
    command: 'echo "10"',
    expect: {
      type: "threshold",
      ...expectation
    }
  }));
  return file;
}

describe("parseEvalSuite", () => {
  it("rejects non-object YAML and JSON documents with file context", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const documents = [
      ["null.yaml", "null\n"],
      ["scalar.yml", "plain text\n"],
      ["array.yaml", "- first\n- second\n"],
      ["null.json", "null"],
      ["scalar.json", "42"],
      ["array.json", "[]"]
    ] as const;

    for (const [name, content] of documents) {
      const file = join(root, name);
      writeFileSync(file, content);
      assert.throws(
        () => parseCaseFile(file),
        (error: Error) => {
          assert.equal(error.message, `${file}: eval case must be an object`);
          assert.doesNotMatch(error.message, /TypeError/);
          return true;
        }
      );
    }
  });

  it("parses a supported single case file", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const file = join(root, "single.yml");
    writeFileSync(file, yamlCase("single"));

    assert.deepEqual(parseEvalSuite(file).map(({ id }) => id), ["single"]);
  });

  it("recursively parses supported files in a directory", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const nested = join(root, "nested");
    mkdirSync(nested);
    writeFileSync(join(root, "first.yaml"), yamlCase("first"));
    writeFileSync(join(nested, "second.json"), JSON.stringify({
      id: "second",
      name: "second",
      category: "parser",
      command: 'echo "ok"',
      expect: { type: "contains", value: "ok" }
    }));
    writeFileSync(join(root, "notes.txt"), "ignored");

    assert.deepEqual(
      parseEvalSuite(root).map(({ id }) => id).sort(),
      ["first", "second"]
    );
  });

  it("rejects duplicate IDs in the same directory with both case paths", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const first = join(root, "first.yaml");
    const second = join(root, "second.yml");
    writeFileSync(first, yamlCase("duplicate"));
    writeFileSync(second, yamlCase("duplicate"));

    assert.throws(
      () => parseEvalSuite(root),
      (error: Error) => {
        assert.match(error.message, /Duplicate eval ID "duplicate"/);
        assert.match(error.message, new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(error.message, new RegExp(second.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        return true;
      }
    );
  });

  it("rejects duplicate IDs across nested directories with both case paths", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const nested = join(root, "nested");
    mkdirSync(nested);
    const first = join(root, "first.json");
    const second = join(nested, "second.yaml");
    writeFileSync(first, JSON.stringify({
      id: "nested-duplicate",
      name: "first",
      category: "parser",
      command: 'echo "ok"',
      expect: { type: "contains", value: "ok" }
    }));
    writeFileSync(second, yamlCase("nested-duplicate"));

    assert.throws(
      () => parseEvalSuite(root),
      (error: Error) => {
        assert.match(error.message, /Duplicate eval ID "nested-duplicate"/);
        assert.match(error.message, new RegExp(first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(error.message, new RegExp(second.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        return true;
      }
    );
  });

  it("rejects an unsupported single file with a clear diagnostic", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const file = join(root, "case.txt");
    writeFileSync(file, "not an eval");

    assert.throws(
      () => parseEvalSuite(file),
      /Unsupported eval file type "\.txt".*Expected \.yaml, \.yml, or \.json/
    );
  });

  it("accepts every supported threshold comparator", () => {
    for (const comparator of ["gte", "lte", "gt", "lt", "eq"]) {
      const file = writeThresholdCase({ threshold: 10, comparator });
      assert.equal(parseCaseFile(file).expect.comparator, comparator);
    }
  });

  it("rejects unsupported threshold comparators with case context", () => {
    const file = writeThresholdCase({
      threshold: 10,
      comparator: "definitely-not-valid"
    });

    assert.throws(
      () => parseCaseFile(file),
      new RegExp(
        `${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\(threshold-case\\): ` +
        'invalid expect\\.comparator "definitely-not-valid"\\. ' +
        "Must be gte\\|lte\\|gt\\|lt\\|eq"
      )
    );
  });

  it("rejects missing, non-numeric, and non-finite thresholds", () => {
    for (const threshold of [undefined, "10", null, Number.NaN, Infinity, -Infinity]) {
      const file = writeThresholdCase({ threshold });
      assert.throws(
        () => parseCaseFile(file),
        /threshold-case\): expect\.threshold must be a finite number/
      );
    }
  });

  it("rejects non-numeric, non-finite, and negative tolerances", () => {
    for (const tolerance of ["0.1", null, Number.NaN, Infinity, -Infinity, -0.1]) {
      const file = writeThresholdCase({ threshold: 10, tolerance });
      assert.throws(
        () => parseCaseFile(file),
        /threshold-case\): expect\.tolerance must be a finite non-negative number/
      );
    }
  });

  it("accepts an omitted tolerance and finite non-negative tolerances", () => {
    for (const tolerance of [undefined, 0, 0.1]) {
      const file = writeThresholdCase({ threshold: 10, tolerance });
      assert.equal(parseCaseFile(file).expect.tolerance, tolerance);
    }
  });
});
