// Runner — executes eval cases and collects results

import { spawn } from "child_process";
import { EvalCase, EvalResult, EvalReport } from "./types";
import { matchOutput } from "./matcher";

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
    const timeout = evalCase.timeout ?? 30000;
    const { stdout, stderr } = await runCommand(evalCase.command, {
      timeout,
      cwd: evalCase.cwd,
      env: evalCase.env,
      stdin: evalCase.stdin,
    });
    const actual = stdout + (stderr ? `[stderr]\n${stderr}` : "");

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

function runCommand(
  command: string,
  options: {
    timeout: number;
    cwd?: string;
    env?: Record<string, string>;
    stdin?: string;
  }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeout);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command exited with code ${code ?? "signal"}`);
        Object.assign(error, { code, signal, stdout, stderr });
        reject(error);
      }
    });

    if (options.stdin) {
      child.stdin.end(options.stdin);
    } else {
      child.stdin.end();
    }
  });
}
