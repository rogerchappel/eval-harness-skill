# PRD: eval-harness-skill

## Problem

Agent skills, CLI workflows, and tool integrations need regression testing. When a skill's instructions change, there should be automated checks that core behaviors still work. Without fixtures and expected outputs, skill quality degrades silently.

## Solution

A local eval harness that:
1. Runs commands/scripts defined in eval case files
2. Compares outputs against expected text, regex patterns, or JSON schemas
3. Emits regression reports with pass/fail/skip/error status

## V1 Scope

- YAML/JSON eval case files
- 5 match types: exact, contains, regex, schema, threshold
- CLI: init, run, smoke
- Library API for programmatic use
- JSON, text, and markdown report formats

## Out of Scope

- Model-provider integrations
- Hosted dashboards
- CI/CD pipeline hooks (V2)
- Cross-model comparison

## Success Criteria

- Can define and run a 10+ case eval suite in under 30 seconds
- Reports are readable and actionable
- Another agent builder can run `eval-harness run evals/` locally
