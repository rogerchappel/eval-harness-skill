# SKILL: eval-harness-skill

## When to Use

Use this skill when you need to:
- Test agent skill behaviors (output format, instruction following, tool usage)
- Regress CLI tool output across versions
- Validate structured outputs against JSON schemas
- Set up fixture-backed test suites for agent workflows

## Required Tools

- Node.js 18+
- Terminal access (for running the CLI)
- No external API keys or credentials required

## Setup

`npm install -g eval-harness-skill`

Or clone and run: `npm install && npm run build`

## Side-Effect Boundaries

- Commands run in evals execute with local user permissions
- The harness itself never makes network calls
- Eval output is truncated at 500 chars in reports by default
- No file writes outside the test/eval directory

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
eval-harness run evals/ --report report.json
```

### Check result

```bash
eval-harness run evals/ --format markdown --report report.md
```

## Validation Workflow

1. Write eval cases in `evals/` directory
2. Run `eval-harness run evals/` to execute
3. Review failures — are they regressions or expected changes?
4. Update eval cases if behavior intentionally changed
5. Save JSON report for regression tracking
6. Compare future runs with `eval-harness run evals/ --previous-report report.json`
