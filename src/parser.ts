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
function assertEvalCaseObject(value: unknown, filePath: string): asserts value is Record<string, unknown> {
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
function validateEvalCase(evalCase: Record<string, unknown>, filePath: string): asserts evalCase is Record<string, unknown> & EvalCase {
  if (evalCase.id === undefined || evalCase.id === "") {
    throw new Error(`${filePath}: missing required field "id"`);
  }
  requireNonEmptyString(evalCase.id, "id", filePath);
  const caseContext = `${filePath} (${evalCase.id})`;
  if (evalCase.name === undefined || evalCase.name === "") {
    evalCase.name = evalCase.id;
  } else {
    requireNonEmptyString(evalCase.name, "name", caseContext);
  }
  if (evalCase.category === undefined || evalCase.category === "") {
    evalCase.category = "uncategorized";
  } else {
    requireNonEmptyString(evalCase.category, "category", caseContext);
  }
  if (evalCase.command === undefined || evalCase.command === "") {
    throw new Error(`${caseContext}: missing required field "command"`);
  }
  requireNonEmptyString(evalCase.command, "command", caseContext);
  validateOptionalFields(evalCase, caseContext);
  if (
    evalCase.timeout !== undefined &&
    (
      typeof evalCase.timeout !== "number" ||
      !Number.isFinite(evalCase.timeout) ||
      evalCase.timeout <= 0
    )
  ) {
    throw new Error(`${caseContext}: timeout must be a finite positive number`);
  }
  if (evalCase.expect === undefined) {
    throw new Error(`${caseContext}: missing required field "expect"`);
  }
  if (!isObject(evalCase.expect)) {
    throw new Error(`${caseContext}: expect must be an object`);
  }
  const expectation = evalCase.expect;
  if (expectation.type === undefined || expectation.type === "") {
    throw new Error(`${caseContext}: missing required field "expect.type"`);
  }
  if (typeof expectation.type !== "string") {
    throw new Error(`${caseContext}: expect.type must be a string`);
  }
  if (!["exact", "contains", "regex", "schema", "threshold"].includes(expectation.type)) {
    throw new Error(
      `${caseContext}: invalid expect.type "${expectation.type}". Must be exact|contains|regex|schema|threshold`
    );
  }
  if (expectation.type === "threshold") {
    if (typeof expectation.threshold !== "number" || !Number.isFinite(expectation.threshold)) {
      throw new Error(
        `${caseContext}: expect.threshold must be a finite number`
      );
    }
    if (
      expectation.comparator !== undefined &&
      !THRESHOLD_COMPARATORS.includes(expectation.comparator as typeof THRESHOLD_COMPARATORS[number])
    ) {
      throw new Error(
        `${caseContext}: invalid expect.comparator "${expectation.comparator}". ` +
        `Must be ${THRESHOLD_COMPARATORS.join("|")}`
      );
    }
    if (
      expectation.tolerance !== undefined &&
      (
        typeof expectation.tolerance !== "number" ||
        !Number.isFinite(expectation.tolerance) ||
        expectation.tolerance < 0
      )
    ) {
      throw new Error(
        `${caseContext}: expect.tolerance must be a finite non-negative number`
      );
    }
    return;
  }
  if (expectation.value === undefined) {
    throw new Error(`${caseContext}: missing expect.value`);
  }
  if (expectation.type === "schema") {
    if (!isObject(expectation.value)) {
      throw new Error(`${caseContext}: expect.value must be an object for schema expectations`);
    }
  } else if (typeof expectation.value !== "string") {
    throw new Error(`${caseContext}: expect.value must be a string for ${expectation.type} expectations`);
  }
}

function requireNonEmptyString(value: unknown, field: string, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context}: ${field} must be a non-empty string`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOptionalFields(evalCase: Record<string, unknown>, context: string): void {
  for (const field of ["cwd", "stdin", "skip"] as const) {
    if (evalCase[field] !== undefined && typeof evalCase[field] !== "string") {
      throw new Error(`${context}: ${field} must be a string`);
    }
  }
  if (evalCase.tags !== undefined && (
    !Array.isArray(evalCase.tags) || evalCase.tags.some((tag) => typeof tag !== "string")
  )) {
    throw new Error(`${context}: tags must be an array of strings`);
  }
  if (evalCase.env !== undefined && (
    !isObject(evalCase.env) || Object.values(evalCase.env).some((value) => typeof value !== "string")
  )) {
    throw new Error(`${context}: env must be an object with string values`);
  }
}
