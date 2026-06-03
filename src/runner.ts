// Runner — executes eval cases and collects results

import { exec } from "child_process";
import { promisify } from "util";
import { EvalCase, EvalResult, EvalReport } from "./types";
import { matchOutput } from "./matcher";

const execAsync = promisify(exec);

/** Run a single eval case and return a result */
export async function runEvalCase(evalCase: EvalCase): Promise<EvalResult> {
  const startMs = Date.now();
  const timestamp = new Date().toISOString();

  // Skip if marked
  if (evalCase.skip) {
    return {
      evalId: evalCase.id,
      name: evalCase.name,
      category: evalCase.category,
      status: "skip",
      message: `Skipped: ${evalCase.skip}`,
      durationMs: Date.now() - startMs,
      timestamp,
    };
  }

  try {
    let actual: string;
    const timeout = evalCase.timeout ?? 30000;

    if (evalCase.stdin) {
      const { stdout, stderr } = await execAsync(evalCase.command, {
        timeout,
        cwd: evalCase.cwd,
        env: { ...process.env, ...evalCase.env },
        input: evalCase.stdin,
      });
      actual = stdout + (stderr ? `[stderr]\n${stderr}` : "");
    } else {
      // Inject env vars as a way to pass context
      const envStr = evalCase.env
        ? Object.entries(evalCase.env)
            .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
            .join(" ")
        : "";
      const cmd = envStr ? `${envStr} ${evalCase.command}` : evalCase.command;
      const { stdout, stderr } = await execAsync(cmd, {
        timeout,
        cwd: evalCase.cwd,
      });
      actual = stdout + (stderr ? `[stderr]\n${stderr}` : "");
    }

    const { passed, message } = matchOutput(actual, evalCase.expect, evalCase);

    return {
      evalId: evalCase.id,
      name: evalCase.name,
      category: evalCase.category,
      status: passed ? "pass" : "fail",
      actual: truncate(actual, 500),
      message,
      durationMs: Date.now() - startMs,
      timestamp,
    };
  } catch (err: any) {
    const signal = err.signal ? ` [signal: ${err.signal}]` : "";
    const code = err.code ? ` [code: ${err.code}]` : "";
    return {
      evalId: evalCase.id,
      name: evalCase.name,
      category: evalCase.category,
      status: "error",
      message: `Execution error: ${err.message}${signal}${code}`,
      durationMs: Date.now() - startMs,
      timestamp,
    };
  }
}

/** Run all eval cases and produce a report */
export async function runEvalSuite(cases: EvalCase[], bail = false): Promise<EvalReport> {
  const startMs = Date.now();
  const results: EvalResult[] = [];

  for (const evalCase of cases) {
    const result = await runEvalCase(evalCase);
    results.push(result);

    if (bail && (result.status === "fail" || result.status === "error")) {
      break;
    }
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errors = results.filter((r) => r.status === "error").length;

  return {
    total: results.length,
    passed,
    failed,
    skipped,
    errors,
    durationMs: Date.now() - startMs,
    timestamp: new Date().toISOString(),
    results,
    regressions: [], // TODO: compare against previous report
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
