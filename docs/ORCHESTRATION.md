# Orchestration: eval-harness-skill

## Workflow

1. **Create eval cases** — Write YAML/JSON files in an `evals/` directory
2. **Run the suite** — `eval-harness run evals/`
3. **Review report** — Fix failures or update expected values
4. **Commit** — Treat eval failures as regressions to investigate

## Integration Points

- **Agent skill testing**: Each agent skill can have its own `evals/` dir
- **CI/CD hook**: Add `eval-harness run evals/` to your test script
- **Regression tracking**: Save JSON reports and diff against previous runs

## File Layout

```
my-skill/
├── evals/
│   ├── output-format.yaml
│   └── schema-validation.yaml
├── src/
│   └── ...
└── package.json
```

## Safety Boundaries

- Eval commands run locally with your user permissions
- No network calls are made by the harness itself
- Set appropriate timeouts to avoid hung processes
- Do not eval commands that write to production systems
