# eval-harness-skill

A local eval harness for agent skills and CLI workflows. Define eval cases in YAML or JSON, run commands or scripts against them, compare outputs against expected text, schemas, or scoring rubrics, and emit regression reports.

## Why This Exists

Agent skills become real when they can be tested. `eval-harness-skill` provides a lightweight, local-first harness for regressing agent skills, tool workflows, and CLI output before deploying changes.

## Quickstart

```bash
# Install
npm install -g eval-harness-skill

# Initialize a new eval suite
eval-harness init --type cli

# Run all evals
eval-harness run evals/

# Run with JSON report
eval-harness run evals/ --report report.json
```

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

## Limitations

- This is a local tool; it does not call AI models or external APIs
- Evals are only as good as your fixtures and expected outputs
- Schema validation supports JSON only (not XML, protobuf, etc.)

## Safety

- All execution is local — no network calls
- No agent credentials or live data are required
- Dry-run mode available: `eval-harness run --dry-run evals/`

## License

MIT
