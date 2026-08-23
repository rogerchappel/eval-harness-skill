# SKILL: eval-harness-skill

## When to Use

Use this skill when you need to:
- Test agent skill behaviors (output format, instruction following, tool usage)
- Regress CLI tool output across versions
- Validate structured outputs against JSON schemas
- Set up fixture-backed test suites for agent workflows

## Required Tools

- Node.js 22.12+
- Terminal access (for running the CLI)
- No external API keys or credentials required

## Setup

The package is not yet published to npm. Install the current source:

```bash
git clone https://github.com/rogerchappel/eval-harness-skill.git
cd eval-harness-skill
npm ci
npm run build
npm install --global .
```

## Side-Effect Boundaries

- `init` creates its sample suite at `--dir`, which may be outside the current directory
- `run` creates parent directories and writes the formatted report at `--report`, which may be outside the eval suite
- Eval commands execute with local user permissions in the selected case `cwd` (or the harness process directory), so they can perform any filesystem or network side effects available to that user
- The harness itself makes no network calls; a command selected by an eval case may do so
- Eval output is truncated at 500 chars in reports by default

## Approval Requirements

- Any eval case that writes files, modifies disk, or calls external services needs human review
- Eval commands with untrusted input should run in a sandbox

## Examples

### Define an eval case

```yaml
id: check-tool-output
name: Tool output includes JSON
category: output-format
command: cat fixtures/sample-output.json
expect:
  type: contains
  value: '"status": "ok"'
```

### Run the suite

```bash
eval-harness run evals/ --format json --report report.json
```

### Check result

```bash
eval-harness run evals/ --format markdown --report report.md
```

`run` accepts a recursive eval directory or one `.yaml`, `.yml`, or `.json`
case file. `--format` selects the format written to both stdout and `--report`.
Previous-report comparisons require a report created with `--format json`.

## Validation Workflow

1. Write eval cases in `evals/` directory
2. Run `eval-harness run evals/` to execute
3. Review failures — are they regressions or expected changes?
4. Update eval cases if behavior intentionally changed
5. Save a JSON report for regression tracking with `--format json --report report.json`
6. Compare future runs with `eval-harness run evals/ --previous-report report.json`
