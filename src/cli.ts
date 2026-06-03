#!/usr/bin/env node
// eval-harness CLI — entry point

import { Command } from "commander";
import { parseEvalSuite } from "./parser";
import { runEvalSuite } from "./runner";
import { formatReport } from "./reporter";
import * as fs from "fs";
import * as path from "path";

const program = new Command();

program
  .name("eval-harness")
  .description("Local eval harness for agent skills and CLI workflows")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new eval suite directory")
  .option("--type <type>", "Eval type (cli, lib)", "cli")
  .option("--dir <dir>", "Output directory", "evals")
  .action((opts) => {
    const dir = opts.dir;
    if (fs.existsSync(dir)) {
      console.log(`Directory ${dir} already exists`);
      return;
    }
    fs.mkdirSync(dir, { recursive: true });

    // Create a sample eval case
    const sample = {
      id: "sample-exact-match",
      name: "Sample exact match eval",
      category: "demo",
      command: opts.type === "cli" ? 'echo "hello world"' : 'node -e "console.log(\\"hello world\\")"',
      expect: { type: "contains", value: "hello world" },
    };
    fs.writeFileSync(path.join(dir, "sample.yaml"), yamlDump(sample));
    console.log(`Initialized eval suite in ${dir}/`);
    console.log(`  Created: ${dir}/sample.yaml`);
  });

program
  .command("run")
  .description("Run eval cases from a directory")
  .argument("<dir>", "Eval cases directory or file")
  .option("-o, --report <file>", "Write JSON report to file")
  .option("-f, --format <format>", "Report format (json, text, markdown)", "text")
  .option("--bail", "Stop on first failure")
  .option("--tag <tags>", "Filter by comma-separated tags")
  .action(async (dir, opts) => {
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

    const report = await runEvalSuite(filtered, opts.bail);

    if (opts.report) {
      fs.writeFileSync(opts.report, formatReport(report, "json"));
      console.log(`Report written to ${opts.report}`);
    }

    const outputFormat = opts.format as "json" | "text" | "markdown";
    const text = formatReport(report, outputFormat === "json" ? "json" : outputFormat);
    console.log(text);

    // Exit with non-zero if any failures
    if (report.failed > 0 || report.errors > 0) {
      process.exit(1);
    }
  });

// Internal helper for YAML dump (simple approach)
function yamlDump(obj: any): string {
  // Use a minimal YAML output — for production use js-yaml.dump
  return JSON.stringify(obj, null, 2)
    .replace(/"id":/g, "id:")
    .replace(/"name":/g, "name:")
    .replace(/"category":/g, "category:")
    .replace(/"command":/g, "command:")
    .replace(/"type":/g, "type:")
    .replace(/"value":/g, "value:")
    .replace(/"expect":/g, "expect:")
    .replace(/"/g, "");
}

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
