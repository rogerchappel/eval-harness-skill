import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseEvalSuite } from "../src/parser";

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

describe("parseEvalSuite", () => {
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

  it("rejects an unsupported single file with a clear diagnostic", () => {
    const root = mkdtempSync(join(tmpdir(), "eval-harness-parser-"));
    const file = join(root, "case.txt");
    writeFileSync(file, "not an eval");

    assert.throws(
      () => parseEvalSuite(file),
      /Unsupported eval file type "\.txt".*Expected \.yaml, \.yml, or \.json/
    );
  });
});
