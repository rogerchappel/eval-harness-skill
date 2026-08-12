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
    const actual = formatErrorOutput(err.stdout, err.stderr);
    return {
      evalId: evalCase.id,
      name: evalCase.name,
      category: evalCase.category,
      status: "error",
      ...(actual ? { actual: truncate(actual, 500) } : {}),
      message: `Execution error: ${err.message}${signal}${code}`,
      durationMs: Date.now() - startMs,
      timestamp,
    };
  }
}

/** Run all eval cases and produce a report */
export async function runEvalSuite(
  cases: EvalCase[],
  bail = false,
  previousReport?: EvalReport
): Promise<EvalReport> {
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
    regressions: findRegressions(results, previousReport),
  };
}

function findRegressions(results: EvalResult[], previousReport?: EvalReport): EvalResult[] {
  if (!previousReport) {
    return [];
  }

  const previousPasses = new Set(
    previousReport.results
      .filter((result) => result.status === "pass")
      .map((result) => result.evalId)
  );

  return results.filter(
    (result) =>
      previousPasses.has(result.evalId) &&
      (result.status === "fail" || result.status === "error")
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatErrorOutput(stdout?: string, stderr?: string): string {
  const parts: string[] = [];

  if (stdout) {
    parts.push(stdout);
  }

  if (stderr) {
    parts.push(`[stderr]\n${stderr}`);
  }

  return parts.join("");
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
    const useProcessGroup = process.platform !== "win32";
    const child = spawn(command, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: true,
      // A separate process group lets timeout cleanup reach the shell and every
      // command it spawned, including descendants that inherited stdout/stderr.
      detached: useProcessGroup,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      killCommandTree(child.pid, "SIGTERM", useProcessGroup);
      forceKillTimer = setTimeout(
        () => killCommandTree(child.pid, "SIGKILL", useProcessGroup),
        100
      );
    }, options.timeout);

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
      if (forceKillTimer) clearTimeout(forceKillTimer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
      if (timedOut) {
        const error = new Error(`Command timed out after ${options.timeout}ms`);
        Object.assign(error, { signal, stdout, stderr });
        reject(error);
        return;
      }
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

function killCommandTree(
  pid: number | undefined,
  signal: NodeJS.Signals,
  useProcessGroup: boolean
): void {
  if (pid === undefined) return;

  try {
    if (useProcessGroup) {
      process.kill(-pid, signal);
    } else {
      process.kill(pid, signal);
    }
  } catch (error: any) {
    // ESRCH means the command tree exited between the timeout and cleanup.
    if (error?.code !== "ESRCH") throw error;
  }
}
