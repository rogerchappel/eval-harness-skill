#!/usr/bin/env node
// eval-harness CLI — entry point

import { Command } from "commander";
import { parseEvalSuite } from "./parser";
import { runEvalSuite } from "./runner";
import { formatReport } from "./reporter";
import { runEmbeddedSmoke } from "./smoke";
import { EvalReport } from "./types";
import * as fs from "fs";
import * as path from "path";
import { yamlDump } from "./yaml";

const program = new Command();
const REPORT_FORMATS = ["json", "text", "markdown"] as const;
const EVAL_TYPES = ["cli", "lib"] as const;
const RESULT_STATUSES = ["pass", "fail", "skip", "error"] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];
type EvalType = (typeof EVAL_TYPES)[number];

program
  .name("eval-harness")
  .description("Local eval harness for agent skills and CLI workflows")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new eval suite directory")
  .option("--type <type>", "Eval type: cli or lib", "cli")
  .option("--dir <dir>", "Output directory", "evals")
  .action((opts) => {
    const type = parseEvalType(opts.type);
    const dir = opts.dir;
    fs.mkdirSync(dir, { recursive: true });

    // Create a sample eval case
    const sample = {
      id: "sample-exact-match",
      name: "Sample exact match eval",
      category: "demo",
      command: type === "cli" ? 'echo "hello world"' : 'node -e "console.log(\\"hello world\\")"',
      expect: { type: "contains", value: "hello world" },
    };
    const samplePath = path.join(dir, "sample.yaml");
    try {
      fs.writeFileSync(samplePath, yamlDump(sample), { flag: "wx" });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "EEXIST") {
        console.error(`Refusing to overwrite existing file: ${samplePath}`);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
    console.log(`Initialized eval suite in ${dir}/`);
    console.log(`  Created: ${samplePath}`);
  });

program
  .command("run")
  .description("Run eval cases from a directory or file")
  .argument("<path>", "Eval cases directory or .yaml, .yml, or .json file")
  .option("-o, --report <file>", "Write the formatted report to file")
  .option("-f, --format <format>", "Report format (json, text, markdown)", "text")
  .option("--previous-report <file>", "Compare against a previous JSON report for regressions")
  .option("--bail", "Stop on first failure")
  .option("--tag <tags>", "Filter by comma-separated tags")
  .action(async (dir, opts) => {
    const outputFormat = parseReportFormat(opts.format);
    const reportPath = opts.report
      ? validateReportPath(dir, opts.report)
      : undefined;
    const cases = parseEvalSuite(dir);

    if (cases.length === 0) {
      console.log(`No eval cases found in ${dir}`);
      process.exit(0);
    }

    const tagFilter = opts.tag
      ? opts.tag.split(",").map((t: string) => t.trim())
      : undefined;

    const filtered = tagFilter
      ? cases.filter((c) => c.tags?.some((t) => tagFilter.includes(t)))
      : cases;

    if (filtered.length === 0) {
      console.log(`No eval cases match tag filter: ${tagFilter?.join(", ")}`);
      process.exit(0);
    }

    let previousReport: EvalReport | undefined;
    if (opts.previousReport) {
      try {
        previousReport = readPreviousReport(opts.previousReport);
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    }

    const report = await runEvalSuite(filtered, opts.bail, previousReport);
    const text = formatReport(report, outputFormat);

    if (reportPath) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, text);
      console.log(`Report written to ${reportPath}`);
    }

    console.log(text);

    // Exit with non-zero if any failures
    if (report.failed > 0 || report.errors > 0) {
      process.exit(1);
    }
  });

// Internal helper for YAML dump (simple approach)
// Smoke command for quick verification
const smoke = program.command("smoke").description("Run embedded smoke test");
smoke.action(async () => {
  console.log("Running smoke test...");
  const report = await runEmbeddedSmoke();

  console.log(formatReport(report, "text"));

  if (report.passed === 1) {
    console.log("Smoke test passed ✓");
  } else {
    console.log("Smoke test failed ✗");
    process.exit(1);
  }
});

program.parse();

function readPreviousReport(file: string): EvalReport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid previous report ${file}: ${detail}`);
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.results)) {
    throw new Error(`Invalid previous report ${file}: expected an object with a results array`);
  }

  parsed.results.forEach((result, index) => validatePreviousResult(result, index, file));
  return parsed as unknown as EvalReport;
}

function validatePreviousResult(value: unknown, index: number, file: string): void {
  const field = `results[${index}]`;
  if (!isRecord(value)) {
    throw new Error(`Invalid previous report ${file}: ${field} must be an object`);
  }
  for (const key of ["evalId", "name", "category", "message", "timestamp"] as const) {
    if (typeof value[key] !== "string" || value[key].trim() === "") {
      throw new Error(`Invalid previous report ${file}: ${field}.${key} must be a non-empty string`);
    }
  }
  if (!RESULT_STATUSES.includes(value.status as (typeof RESULT_STATUSES)[number])) {
    throw new Error(`Invalid previous report ${file}: ${field}.status must be ${RESULT_STATUSES.join(", ")}`);
  }
  if (typeof value.durationMs !== "number" || !Number.isFinite(value.durationMs) || value.durationMs < 0) {
    throw new Error(`Invalid previous report ${file}: ${field}.durationMs must be a finite non-negative number`);
  }
  if (value.actual !== undefined && typeof value.actual !== "string") {
    throw new Error(`Invalid previous report ${file}: ${field}.actual must be a string when provided`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseReportFormat(format: string): ReportFormat {
  if (!REPORT_FORMATS.includes(format as ReportFormat)) {
    throw new Error(
      `Unsupported report format "${format}". Expected ${REPORT_FORMATS.join(", ")}`
    );
  }
  return format as ReportFormat;
}

function parseEvalType(type: string): EvalType {
  if (!EVAL_TYPES.includes(type as EvalType)) {
    throw new Error(
      `Unsupported eval type "${type}". Expected ${EVAL_TYPES.join(" or ")}`
    );
  }
  return type as EvalType;
}

function validateReportPath(input: string, report: string): string {
  const inputPath = resolvePath(input);
  const reportPath = resolvePath(report);

  if (fs.existsSync(inputPath) && fs.statSync(inputPath).isFile()) {
    if (reportPath === inputPath) {
      throw new Error(`Report path must not overwrite an eval case: ${report}`);
    }
    return reportPath;
  }

  if (fs.existsSync(inputPath) && fs.statSync(inputPath).isDirectory()) {
    const relative = path.relative(inputPath, reportPath);
    if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
      throw new Error(
        `Report path must be outside the eval suite and must not overwrite an eval case: ${report}`
      );
    }
  }

  return reportPath;
}

/** Resolve symlinks in the existing portion of a path without requiring its destination to exist. */
function resolvePath(candidate: string): string {
  let existing = path.resolve(candidate);
  const missingSegments: string[] = [];

  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      break;
    }
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }

  return path.join(fs.realpathSync(existing), ...missingSegments);
}
