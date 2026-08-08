# eval-harness-skill

A local eval harness for agent skills and CLI workflows. Define eval cases in YAML or JSON, run commands or scripts against them, compare outputs against expected text, schemas, or scoring rubrics, and emit regression reports.

## Why This Exists

Agent skills become real when they can be tested. `eval-harness-skill` provides a lightweight, local-first harness for regressing agent skills, tool workflows, and CLI output before deploying changes.

## Quickstart

```bash
# Install the current source (the package is not yet published to npm)
git clone https://github.com/rogerchappel/eval-harness-skill.git
cd eval-harness-skill
npm ci
npm run build
npm install --global .

# Initialize a new eval suite
cd ..
eval-harness init --type cli

# Run all evals
eval-harness run evals/

# Run one YAML, YML, or JSON eval case
eval-harness run evals/tool-call-format.yaml

# Write a JSON report (the selected format applies to stdout and the file)
eval-harness run evals/ --format json --report report.json

# Write a Markdown report
eval-harness run evals/ --format markdown --report report.md

# Compare against a saved report to flag pass-to-fail regressions
eval-harness run evals/ --previous-report report.json --format markdown
```

`init --type` accepts `cli` (the default) or `lib`. The `cli` sample uses a
shell command, while the `lib` sample invokes Node.js. Unsupported types are
rejected without creating the output directory.

## Structure

An eval suite lives in a directory with individual case files:

```
evals/
├── tool-call-format.yaml
├── skill-instruction-follow.yaml
└── schema-output.yaml
```

Each case specifies:

- A command or script to run
- Input (stdin, file, or inline)
- Expected output (exact text, regex pattern, or schema validation)
- Scoring rubric (pass/fail/threshold)

`run` accepts either a single `.yaml`, `.yml`, or `.json` case or a directory,
which is searched recursively. The `--format` option controls both stdout and
`--report` file contents. Use `--format json` when creating a file for a later
`--previous-report` comparison.

Every case `id` must be unique across the complete recursive suite. Duplicate
IDs are rejected before any case command runs, and the error identifies both
conflicting case files.

Threshold expectations require the command's complete trimmed output to be a
finite JavaScript number. Surrounding whitespace is allowed, but partial
values such as `42oops` and non-finite values such as `Infinity` are rejected.

## Verification

Run the same release-readiness gate used by CI:

```bash
npm run release:check
```

This includes linting, type checking, tests, the embedded smoke test, package
contents validation, and a smoke test that installs the packed artifact in a
temporary project and exercises `--help`, `init`, `run`, and `smoke`.

## Limitations

- This is a local tool; it does not call AI models or external APIs
- Evals are only as good as your fixtures and expected outputs
- Schema validation supports JSON only (not XML, protobuf, etc.)

## Safety

- All execution is local — no network calls
- No agent credentials or live data are required
- Review eval case files before running them because commands execute locally

## License

MIT

## Development

```sh
git clone https://github.com/rogerchappel/eval-harness-skill.git
cd eval-harness-skill
npm install
npm test
npm run smoke
```

## Release readiness

Run the release gate before tagging or publishing:

```sh
npm run release:check
```

The package checks print the tarball contents so missing runtime files are
caught, then install that tarball outside the checkout and exercise the
installed CLI.
