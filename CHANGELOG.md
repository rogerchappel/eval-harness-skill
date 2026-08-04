# Changelog

## [Unreleased]

- Refresh the lockfile to use `fast-uri` 3.1.5, resolving [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7) in AJV's runtime dependency tree.
- Add release-readiness checks for package metadata, pack contents, and CI verification.
- Accept individual YAML, YML, and JSON eval files as `run` inputs.
- Write `--report` files in the selected JSON, text, or Markdown format.
- Reject partial and non-finite command output in threshold expectations.
- Reject unsupported `init --type` values before creating an eval directory.

## 0.1.0

- Initial release candidate for local eval suite parsing, command execution, matching, reporting, and CLI smoke verification.
- Includes YAML and JSON fixture cases for exact, contains, regex, schema, and threshold expectations.
