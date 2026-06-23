# Release Verification

Use this checklist before cutting a package or asking reviewers to trust the current branch.

## Local Gate

```sh
npm run release:check
```

The release gate runs lint, project checks, smoke coverage, and the package dry-run declared in `package.json`. CI mirrors the same gate so pull requests exercise the install path and published package boundary.

## Package Boundary

The `files` allowlist in `package.json` is intentionally conservative. Add new runtime directories there when future releases need them; do not rely on npm's implicit package contents.
