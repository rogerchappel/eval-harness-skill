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

Case files are validated before any command executes. `id`, `name`, `category`,
and `command` are non-empty strings (`name` defaults to `id` and `category` to
`uncategorized` when omitted). Optional `cwd`, `stdin`, and `skip` values are
strings; `tags` is an array of strings; `env` is an object whose values are
strings; and `timeout` is a finite positive number.

`expect` must be an object with a `type` of `exact`, `contains`, `regex`,
`schema`, or `threshold`. Text and regex matchers require a string `value`;
`schema` requires an object `value`; and `threshold` requires a finite numeric
`threshold`, with an optional `gte`, `lte`, `gt`, `lt`, or `eq` comparator and
an optional finite non-negative tolerance. Schema errors identify the case
file and invalid field, and prevent every command in that input from running.

`run` accepts either a single `.yaml`, `.yml`, or `.json` case or a directory,
which is searched recursively. The `--format` option controls both stdout and
`--report` file contents. Use `--format json` when creating a file for a later
`--previous-report` comparison. Previous reports are validated completely
before any case command executes: the document must contain a `results` array,
and every result must contain the non-empty strings, supported status, and
finite non-negative duration produced by this harness. Malformed entries are
rejected with a file-specific diagnostic.

Report destinations may use parent directories that do not exist yet; the CLI
creates them before writing the report. A report must not overwrite a single
case input and must be outside a directory used as a recursively scanned suite.
Keeping reports outside the suite prevents generated JSON from being discovered
as an eval case on later runs. These paths are resolved before any case command
executes, including through existing symlinks.

Every case `id` must be unique across the complete recursive suite. Duplicate
IDs are rejected before any case command runs, and the error identifies both
conflicting case files.

Threshold expectations require the command's complete trimmed output to be a
finite JavaScript number. Surrounding whitespace is allowed, but partial
values such as `42oops` and non-finite values such as `Infinity` are rejected.

Cases may set `timeout` to a finite positive number of milliseconds; the
default is 30000. When the deadline expires, the harness terminates the spawned
command tree and records an `error` result with an explicit timeout diagnostic.
This prevents descendants from keeping output pipes open after their parent
shell is terminated.

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

- The harness itself makes no network calls, but eval commands run with the
  invoking user's permissions and may access the filesystem or network
- `init --dir` and `run --report` may write outside the eval suite; review
  destination paths before running them
- No agent credentials or live data are required
- Review eval case files, including each optional `cwd`, before running them

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

The smoke command creates a unique disposable directory in the operating system's temporary area and removes it after either success or failure. It does not reuse or delete project-local `.tmp` content.

## Release readiness

Run the release gate before tagging or publishing:

```sh
npm run release:check
```

The package checks print the tarball contents so missing runtime files are
caught, then install that tarball outside the checkout and exercise the
installed CLI.
