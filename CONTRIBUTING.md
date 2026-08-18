# Contributing

Thank you for helping improve `eval-harness-skill`.

## Local Checks

Use Node.js 22.12 or newer and run the full verification set before opening a pull request:

```sh
npm ci
npm run check
npm test
npm run build
npm run smoke
npm run package:smoke
```

Keep fixtures small, deterministic, and safe to run locally. Do not add eval cases that require live credentials, private data, or network access.
