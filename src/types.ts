// Core type definitions for eval-harness-skill

export interface EvalCase {
  /** Unique identifier for this eval case */
  id: string;
  /** Human-readable name */
  name: string;
  /** Category for grouping (e.g. "output-format", "schema", "instruction-follow") */
  category: string;
  /** Command to execute */
  command: string;
  /** Working directory for command execution */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Input to pass via stdin */
  stdin?: string;
  /** Expected output matcher */
  expect: OutputExpectation;
  /** Optional timeout in ms */
  timeout?: number;
  /** Skip this eval case with explanation */
  skip?: string;
  /** Tags for filtering */
  tags?: string[];
}

export interface OutputExpectation {
  /** Match type */
  type: "exact" | "contains" | "regex" | "schema" | "threshold";
  /** Expected value (string, regex pattern, or JSON schema) */
  value: string | object;
  /** For threshold type: numeric threshold to compare against */
  threshold?: number;
  /** Threshold comparison operator */
  comparator?: "gte" | "lte" | "eq" | "gt" | "lt";
  /** Tolerance for numeric comparisons */
  tolerance?: number;
}

export interface EvalResult {
  evalId: string;
  name: string;
  category: string;
  status: "pass" | "fail" | "skip" | "error";
  actual?: string;
  message: string;
  durationMs: number;
  timestamp: string;
}

export interface EvalReport {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  durationMs: number;
  timestamp: string;
  results: EvalResult[];
  regressions: EvalResult[]; // results that previously passed but now fail
}

export interface HarnessConfig {
  /** Eval suites directory */
  evalsDir: string;
  /** Output format for reports */
  reportFormat: "json" | "text" | "markdown";
  /** Fail on first error */
  bail?: boolean;
  /** Filter by tags */
  tagFilter?: string[];
  /** Timeout per case in ms */
  defaultTimeout?: number;
}
