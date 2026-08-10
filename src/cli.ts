#!/usr/bin/env node
// eval-harness CLI — entry point

import { Command } from "commander";
import { parseEvalSuite } from "./parser";
import { runEvalSuite } from "./runner";
import { formatReport } from "./reporter";
import { EvalReport } from "./types";
import * as fs from "fs";
import * as path from "path";
import { yamlDump } from "./yaml";

const program = new Command();
const REPORT_FORMATS = ["json", "text", "markdown"] as const;
const EVAL_TYPES = ["cli", "lib"] as const;
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

    const previousReport = opts.previousReport
      ? readPreviousReport(opts.previousReport)
      : undefined;

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

  // Test: exact match
  const tmpDir = ".tmp/smoke";
  fs.mkdirSync(tmpDir, { recursive: true });

  // Create a simple eval case
  const sample = {
    id: "smoke-echo",
    name: "Smoke echo test",
    category: "smoke",
    command: "echo hello",
    expect: { type: "contains", value: "hello" },
  };
  fs.writeFileSync(path.join(tmpDir, "smoke.yaml"), yamlDump(sample));

  const cases = parseEvalSuite(tmpDir);
  const report = await runEvalSuite(cases);

  console.log(formatReport(report, "text"));

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });

  if (report.passed === 1) {
    console.log("Smoke test passed ✓");
  } else {
    console.log("Smoke test failed ✗");
    process.exit(1);
  }
});

program.parse();

function readPreviousReport(file: string): EvalReport {
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as EvalReport;

  if (!Array.isArray(parsed.results)) {
    throw new Error(`Previous report must be a JSON eval report with a results array: ${file}`);
  }

  return parsed;
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
