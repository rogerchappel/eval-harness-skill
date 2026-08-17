// YAML/JSON eval case parser — reads eval suite files from disk

import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
import { EvalCase } from "./types";

const CASE_EXTENSIONS = [".yaml", ".yml", ".json"];
const THRESHOLD_COMPARATORS = ["gte", "lte", "gt", "lt", "eq"] as const;

/** Parse a single eval case file */
export function parseCaseFile(filePath: string): EvalCase {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  let parsed: unknown;

  if (ext === ".json") {
    parsed = JSON.parse(content);
  } else {
    parsed = yaml.load(content);
  }

  assertEvalCaseObject(parsed, filePath);
  validateEvalCase(parsed, filePath);
  return parsed;
}

/** Reject document shapes that cannot represent an eval case before field access. */
function assertEvalCaseObject(value: unknown, filePath: string): asserts value is EvalCase {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${filePath}: eval case must be an object`);
  }
}

/** Parse all eval case files from a directory */
export function parseEvalSuite(dir: string): EvalCase[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`Eval path not found: ${dir}`);
  }

  const inputStat = fs.statSync(dir);
  if (inputStat.isFile()) {
    const extension = path.extname(dir).toLowerCase();
    if (!CASE_EXTENSIONS.includes(extension)) {
      throw new Error(
        `Unsupported eval file type "${extension || "(none)"}": ${dir}. Expected .yaml, .yml, or .json`
      );
    }
    return [parseCaseFile(dir)];
  }
  if (!inputStat.isDirectory()) {
    throw new Error(`Eval path must be a directory or .yaml, .yml, or .json file: ${dir}`);
  }

  const caseFiles = collectCaseFiles(dir);
  const cases = caseFiles.map(parseCaseFile);
  const firstPathById = new Map<string, string>();

  cases.forEach((evalCase, index) => {
    const firstPath = firstPathById.get(evalCase.id);
    if (firstPath) {
      throw new Error(
        `Duplicate eval ID "${evalCase.id}" in ${firstPath} and ${caseFiles[index]}`
      );
    }
    firstPathById.set(evalCase.id, caseFiles[index]);
  });

  return cases;
}

function collectCaseFiles(dir: string): string[] {
  const caseFiles: string[] = [];
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // recurse into subdirectories
      caseFiles.push(...collectCaseFiles(fullPath));
      continue;
    }

    if (!CASE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      continue;
    }

    caseFiles.push(fullPath);
  }

  return caseFiles;
}

/** Basic schema validation before execution */
function validateEvalCase(evalCase: EvalCase, filePath: string): void {
  if (!evalCase.id) {
    throw new Error(`${filePath}: missing required field "id"`);
  }
  if (!evalCase.name) {
    evalCase.name = evalCase.id;
  }
  if (!evalCase.category) {
    evalCase.category = "uncategorized";
  }
  if (!evalCase.command) {
    throw new Error(`${filePath} (${evalCase.id}): missing required field "command"`);
  }
  if (
    evalCase.timeout !== undefined &&
    (
      typeof evalCase.timeout !== "number" ||
      !Number.isFinite(evalCase.timeout) ||
      evalCase.timeout <= 0
    )
  ) {
    throw new Error(`${filePath} (${evalCase.id}): timeout must be a finite positive number`);
  }
  if (!evalCase.expect) {
    throw new Error(`${filePath} (${evalCase.id}): missing required field "expect"`);
  }
  if (!evalCase.expect.type) {
    throw new Error(`${filePath} (${evalCase.id}): missing required field "expect.type"`);
  }
  if (!["exact", "contains", "regex", "schema", "threshold"].includes(evalCase.expect.type)) {
    throw new Error(
      `${filePath} (${evalCase.id}): invalid expect.type "${evalCase.expect.type}". Must be exact|contains|regex|schema|threshold`
    );
  }
  if (evalCase.expect.type === "threshold") {
    if (typeof evalCase.expect.threshold !== "number" || !Number.isFinite(evalCase.expect.threshold)) {
      throw new Error(
        `${filePath} (${evalCase.id}): expect.threshold must be a finite number`
      );
    }
    if (
      evalCase.expect.comparator !== undefined &&
      !THRESHOLD_COMPARATORS.includes(evalCase.expect.comparator)
    ) {
      throw new Error(
        `${filePath} (${evalCase.id}): invalid expect.comparator "${evalCase.expect.comparator}". ` +
        `Must be ${THRESHOLD_COMPARATORS.join("|")}`
      );
    }
    if (
      evalCase.expect.tolerance !== undefined &&
      (
        typeof evalCase.expect.tolerance !== "number" ||
        !Number.isFinite(evalCase.expect.tolerance) ||
        evalCase.expect.tolerance < 0
      )
    ) {
      throw new Error(
        `${filePath} (${evalCase.id}): expect.tolerance must be a finite non-negative number`
      );
    }
    return;
  }
  if (evalCase.expect.value === undefined && evalCase.expect.threshold === undefined) {
    throw new Error(`${filePath} (${evalCase.id}): missing expect.value or expect.threshold`);
  }
}
