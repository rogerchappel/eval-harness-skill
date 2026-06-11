# Security

`eval-harness-skill` runs local commands described by eval cases. Treat eval suites from other projects as executable code and review them before running.

## Reporting a Vulnerability

Please report security issues privately through GitHub Security Advisories for this repository when available, or open an issue with sensitive details omitted.

## Safety Expectations

- Do not commit credentials, private data, or production-only fixtures.
- Prefer deterministic commands that run inside the repository or a temporary fixture directory.
- Use dry-run mode when inspecting unfamiliar eval suites.
