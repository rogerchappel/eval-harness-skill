// YAML/JSON eval case parser — reads eval suite files from disk

import * as fs from "fs";
import * as path from "path";
import yaml from "js-yaml";
import { EvalCase } from "./types";

const CASE_EXTENSIONS = [".yaml", ".yml", ".json"];

/** Parse a single eval case file */
export function parseCaseFile(filePath: string): EvalCase {
  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();
  let parsed: EvalCase;

  if (ext === ".json") {
    parsed = JSON.parse(content);
  } else {
    parsed = yaml.load(content) as EvalCase;
  }

  validateEvalCase(parsed, filePath);
  return parsed;
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

  const cases: EvalCase[] = [];
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // recurse into subdirectories
      cases.push(...parseEvalSuite(fullPath));
      continue;
    }

    if (!CASE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      continue;
    }

    const caseFile = parseCaseFile(fullPath);
    cases.push(caseFile);
  }

  return cases;
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
  if (evalCase.expect.value === undefined && evalCase.expect.threshold === undefined) {
    throw new Error(`${filePath} (${evalCase.id}): missing expect.value or expect.threshold`);
  }
}
