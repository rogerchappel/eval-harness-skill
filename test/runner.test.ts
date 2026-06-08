// Tests for eval-harness-skill

import * as fs from "fs";
import * as path from "path";
import { parseCaseFile, parseEvalSuite } from "../src/parser";
import { matchOutput } from "../src/matcher";
import { runEvalCase } from "../src/runner";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

// ===== Parser Tests =====
console.log("\nParser Tests:");

// Create temp dir for tests
const tmpDir = ".tmp/tests";
fs.rmSync(tmpDir, { recursive: true, force: true });
fs.mkdirSync(path.join(tmpDir, "evals"), { recursive: true });

// Test: parse valid YAML
fs.writeFileSync(path.join(tmpDir, "evals", "test-a.yaml"), `id: test-a
name: Test A
category: unit
command: echo hello
expect:
  type: contains
  value: hello
`);

try {
  const cases = parseEvalSuite(path.join(tmpDir, "evals"));
  assert(cases.length === 1, "Parses single YAML case");
  assert(cases[0].id === "test-a", "Case ID correct");
  assert(cases[0].expect.type === "contains", "Expect type correct");
} catch (e: any) {
  console.log(`  ✗ Parser test failed: ${e.message}`);
  failed += 3;
}

// Test: parse valid JSON
fs.writeFileSync(path.join(tmpDir, "evals", "test-b.json"), JSON.stringify({
  id: "test-b",
  name: "Test B",
  category: "unit",
  command: "echo world",
  expect: { type: "exact", value: "world" },
}));

try {
  const cases = parseEvalSuite(path.join(tmpDir, "evals"));
  assert(cases.length === 2, "Parses multiple case files from dir");
} catch (e: any) {
  console.log(`  ✗ Multi-file parse failed: ${e.message}`);
  failed++;
}

// Test: validation rejects missing id
fs.writeFileSync(path.join(tmpDir, "evals", "bad.yaml"), JSON.stringify({
  command: "echo oops",
  expect: { type: "exact", value: "hello" },
}));

try {
  parseEvalSuite(path.join(tmpDir, "evals"));
  assert(false, "Should reject missing id");
} catch {
  assert(true, "Rejects eval case missing id");
}

// Test: validation rejects missing command
fs.writeFileSync(path.join(tmpDir, "evals", "bad.yaml"), JSON.stringify({
  id: "bad",
  expect: { type: "exact", value: "hello" },
}));

try {
  parseEvalSuite(path.join(tmpDir, "evals"));
  assert(false, "Should reject missing command");
} catch {
  assert(true, "Rejects eval case missing command");
}

// Test: non-case files ignored
fs.unlinkSync(path.join(tmpDir, "evals", "bad.yaml"));
fs.writeFileSync(path.join(tmpDir, "evals", "README.md"), "# evals");
try {
  const cases = parseEvalSuite(path.join(tmpDir, "evals"));
  assert(cases.length === 2, "Ignores non-yaml/json files");
} catch (e: any) {
  console.log(`  ✗ File filter test failed: ${e.message}`);
  failed++;
}

// Test: directory not found
try {
  parseEvalSuite("/nonexistent/path");
  assert(false, "Should throw for nonexistent dir");
} catch {
  assert(true, "Throws for nonexistent eval directory");
}

// ===== Matcher Tests =====
console.log("\nMatcher Tests:");

// Exact match
assert(matchOutput("hello", { type: "exact", value: "hello" }, {} as any).passed === true, "Exact match passes");
assert(matchOutput("hello", { type: "exact", value: "world" }, {} as any).passed === false, "Exact mismatch fails");

// Contains match
assert(matchOutput("hello world foo", { type: "contains", value: "world" }, {} as any).passed === true, "Contains match passes");
assert(matchOutput("hello", { type: "contains", value: "world" }, {} as any).passed === false, "Contains mismatch fails");

// Regex match
assert(matchOutput("2024-01-15", { type: "regex", value: "^\\d{4}-\\d{2}-\\d{2}$" }, {} as any).passed === true, "Regex passes on match");
assert(matchOutput("not-a-date", { type: "regex", value: "^\\d{4}-\\d{2}-\\d{2}$" }, {} as any).passed === false, "Regex fails on non-match");

// Schema match
const schema = { type: "object", required: ["name"], properties: { name: { type: "string" } } };
assert(matchOutput('{"name": "test"}', { type: "schema", value: schema }, {} as any).passed === true, "Schema validation passes");
assert(matchOutput('{"other": "value"}', { type: "schema", value: schema }, {} as any).passed === false, "Schema validation fails on missing required");
assert(matchOutput('not json', { type: "schema", value: schema }, {} as any).passed === false, "Non-JSON output fails schema check");

// Threshold match
assert(matchOutput("42", { type: "threshold", threshold: 40, comparator: "gte" }, {} as any).passed === true, "Threshold >= passes");
assert(matchOutput("39", { type: "threshold", threshold: 40, comparator: "gte" }, {} as any).passed === false, "Threshold < fails");
assert(matchOutput("5", { type: "threshold", threshold: 5, comparator: "eq", tolerance: 0.1 }, {} as any).passed === true, "Threshold eq with tolerance passes");

// ===== Runner Tests =====
console.log("\nRunner Tests:");

(async () => {
  const passCase = {
    id: "t1", name: "Pass case", category: "test", command: "echo ok",
    expect: { type: "contains", value: "ok" } as any,
  };
  const result = await runEvalCase(passCase);
  assert(result.status === "pass", "Running case with matching output passes");

  const failCase = {
    id: "t2", name: "Fail case", category: "test", command: "echo no",
    expect: { type: "exact", value: "yes" } as any,
  };
  const failResult = await runEvalCase(failCase);
  assert(failResult.status === "fail", "Running case with non-matching output fails");

  const skipCase = {
    id: "t3", name: "Skip case", category: "test", command: "echo skip",
    skip: "not ready",
    expect: { type: "exact", value: "anything" } as any,
  };
  const skipResult = await runEvalCase(skipCase);
  assert(skipResult.status === "skip", "Skipped case returns skip status");

  const errorCase = {
    id: "t4", name: "Error case", category: "test", command: "false",
    expect: { type: "exact", value: "anything" } as any,
  };
  const errorResult = await runEvalCase(errorCase);
  assert(errorResult.status === "error", "non-zero exit returns an execution error");

  // Summary
  console.log(`\n  ${passed} passed, ${failed} failed, out of ${passed + failed} tests`);
  if (failed > 0) {
    process.exit(1);
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
})();
