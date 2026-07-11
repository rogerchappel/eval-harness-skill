import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("eval-harness CLI help", () => {
  it("prints help through the package bin wrapper", () => {
    const result = spawnSync(process.execPath, ["bin/eval-harness.js", "--help"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8"
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /eval-harness/);
  });
});
