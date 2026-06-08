# Release Candidate: eval-harness-skill v0.1.0

## Scope
Local regression harness for agent skills and CLI workflows.

## Capabilities
- Eval suite parser for YAML and JSON case files.
- Output matchers for exact text, contains, regex, JSON schema, and numeric thresholds.
- Runner support for command timeouts, stdin, cwd, environment variables, skip markers, and bail mode.
- Text, JSON, and Markdown report formatting.
- CLI commands for `init`, `run`, and `smoke`.
- Fixture-backed tests across parser, matcher, and runner behavior.

## Verification Results
```
$ npm test
24 passed, 0 failed, out of 24 tests

$ npm run check
tsc --noEmit

$ npm run build
tsc

$ npm run smoke
Smoke test passed
```

## Release Candidate Checklist
- CLI can be exercised locally without external services.
- Fixtures cover passing, failing, skipped, schema, regex, and threshold cases.
- External side effects are limited to commands defined by the local eval files.
- Report output is deterministic enough for agent regression comparisons.

## Branch Protection
Pending best-effort GitHub branch protection setup.

## Classification: ship
Ready for agent builders to define local eval cases and regression-check skills or CLI workflows.
