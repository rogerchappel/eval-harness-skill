// Output matcher — compares actual output against expected expectation

import Ajv from "ajv";
import { EvalCase, OutputExpectation } from "./types";

const ajv = new Ajv({ allErrors: true });

/** Match actual output against expectation */
export function matchOutput(actual: string | null, expectation: OutputExpectation, evalCase: EvalCase): { passed: boolean; message: string } {
  const trimmed = (actual ?? "").trim();

  switch (expectation.type) {
    case "exact":
      return matchExact(trimmed, expectation);
    case "contains":
      return matchContains(trimmed, expectation);
    case "regex":
      return matchRegex(trimmed, expectation);
    case "schema":
      return matchSchema(trimmed, expectation);
    case "threshold":
      return matchThreshold(trimmed, expectation);
    default:
      return { passed: false, message: `Unknown expectation type: ${(expectation as any).type}` };
  }
}

function matchExact(actual: string, exp: OutputExpectation): { passed: boolean; message: string } {
  const expected = String(exp.value);
  if (actual === expected) {
    return { passed: true, message: "Output matches exactly" };
  }
  return {
    passed: false,
    message: `Output mismatch.\nExpected: "${truncate(expected, 200)}"\nActual:   "${truncate(actual, 200)}"`,
  };
}

function matchContains(actual: string, exp: OutputExpectation): { passed: boolean; message: string } {
  const needle = String(exp.value);
  if (actual.includes(needle)) {
    return { passed: true, message: `Output contains "${truncate(needle, 100)}"` };
  }
  return {
    passed: false,
    message: `Output does not contain "${truncate(needle, 100)}"\nActual: "${truncate(actual, 200)}"`,
  };
}

function matchRegex(actual: string, exp: OutputExpectation): { passed: boolean; message: string } {
  const pattern = String(exp.value);
  try {
    const re = new RegExp(pattern);
    if (re.test(actual)) {
      return { passed: true, message: `Output matches regex /${pattern}/` };
    }
    return {
      passed: false,
      message: `Output does not match regex /${pattern}/\nActual: "${truncate(actual, 200)}"`,
    };
  } catch (e: any) {
    return { passed: false, message: `Invalid regex: ${pattern} (${e.message})` };
  }
}

function matchSchema(actual: string, exp: OutputExpectation): { passed: boolean; message: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(actual);
  } catch {
    return {
      passed: false,
      message: `Output is not valid JSON — cannot validate against schema`,
    };
  }

  try {
    const validate = ajv.compile(exp.value as object);
    const valid = validate(parsed);
    if (valid) {
      return { passed: true, message: "Output conforms to JSON schema" };
    }
    const errors = ajv.errorsText(validate.errors);
    return {
      passed: false,
      message: `Schema validation failed:\n${errors}\nActual: ${truncate(actual, 200)}`,
    };
  } catch (e: any) {
    return { passed: false, message: `Invalid JSON schema: ${e.message}` };
  }
}

function matchThreshold(actual: string, exp: OutputExpectation): { passed: boolean; message: string } {
  const num = parseFloat(actual);
  if (isNaN(num)) {
    return { passed: false, message: `Cannot parse numeric value from output: "${truncate(actual, 50)}"` };
  }

  const threshold = exp.threshold ?? 0;
  const op = exp.comparator ?? "gte";
  const tolerance = exp.tolerance ?? 0;

  let passed = false;
  switch (op) {
    case "gte": passed = num >= threshold - tolerance; break;
    case "lte": passed = num <= threshold + tolerance; break;
    case "gt":  passed = num > threshold - tolerance; break;
    case "lt":  passed = num < threshold + tolerance; break;
    case "eq":  passed = Math.abs(num - threshold) <= tolerance; break;
  }

  if (passed) {
    return { passed: true, message: `Value ${num} ${op} threshold ${threshold} (±${tolerance})` };
  }
  return {
    passed: false,
    message: `Value ${num} does not satisfy ${op} ${threshold} (±${tolerance})`,
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
