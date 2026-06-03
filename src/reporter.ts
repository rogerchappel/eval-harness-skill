// Reporter — format eval results to text, JSON, or markdown

import { EvalReport } from "./types";

/** Format a report for display or file output */
export function formatReport(report: EvalReport, format: "json" | "text" | "markdown"): string {
  switch (format) {
    case "json":
      return JSON.stringify(report, null, 2);
    case "text":
      return formatText(report);
    case "markdown":
      return formatMarkdown(report);
    default:
      return formatText(report);
  }
}

function formatText(report: EvalReport): string {
  const lines: string[] = [];
  lines.push("=");
  lines.push(`  EVAL REPORT  ${report.timestamp}`);
  lines.push("=");
  lines.push("");
  lines.push(`  Total:   ${report.total}`);
  lines.push(`  Passed:  ${report.passed}`);
  lines.push(`  Failed:  ${report.failed}`);
  lines.push(`  Skipped: ${report.skipped}`);
  lines.push(`  Errors:  ${report.errors}`);
  lines.push(`  Duration: ${report.durationMs}ms`);
  lines.push("");

  if (report.failed > 0 || report.errors > 0) {
    lines.push("  FAILURES");
    lines.push("  --------");
    for (const r of report.results) {
      if (r.status === "fail" || r.status === "error") {
        lines.push(`  ✗ ${r.name} [${r.category}] — ${r.message}`);
      }
    }
    lines.push("");
  }

  if (report.skipped > 0) {
    lines.push("  SKIPPED");
    lines.push("  -------");
    for (const r of report.results) {
      if (r.status === "skip") {
        lines.push(`  ⊘ ${r.name} — ${r.message}`);
      }
    }
    lines.push("");
  }

  if (report.regressions.length > 0) {
    lines.push("  REGRESSIONS");
    lines.push("  -----------");
    for (const r of report.regressions) {
      lines.push(`  ↻ ${r.name} — was pass, now ${r.status}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatMarkdown(report: EvalReport): string {
  const lines: string[] = [];
  lines.push(`# Eval Report — ${report.timestamp}`);
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|------:|`);
  lines.push(`| Total | ${report.total} |`);
  lines.push(`| Passed | ${report.passed} |`);
  lines.push(`| Failed | ${report.failed} |`);
  lines.push(`| Skipped | ${report.skipped} |`);
  lines.push(`| Errors | ${report.errors} |`);
  lines.push(`| Duration | ${report.durationMs}ms |`);
  lines.push("");

  lines.push("## Failures");
  lines.push("");
  const failures = report.results.filter((r) => r.status === "fail" || r.status === "error");
  if (failures.length === 0) {
    lines.push("None ✓");
  } else {
    for (const r of failures) {
      lines.push(`- **${r.name}** [\`${r.category}\`] — ${r.message}`);
    }
  }
  lines.push("");

  lines.push("## All Results");
  lines.push("");
  lines.push("| Eval | Category | Status | Duration |");
  lines.push("|------|----------|--------|---------:|");
  for (const r of report.results) {
    const icon = statusIcon(r.status);
    lines.push(`| ${r.name} | ${r.category} | ${icon} ${r.status} | ${r.durationMs}ms |`);
  }
  lines.push("");

  return lines.join("\n");
}

function statusIcon(status: string): string {
  switch (status) {
    case "pass": return "✅";
    case "fail": return "❌";
    case "error": return "⚠️";
    case "skip": return "⊘";
    default: return "❓";
  }
}
