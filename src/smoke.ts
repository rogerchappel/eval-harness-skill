import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { parseEvalSuite } from "./parser";
import { runEvalSuite } from "./runner";

export async function runEmbeddedSmoke(command = "echo hello", tempRoot = os.tmpdir()) {
  const tmpDir = fs.mkdtempSync(path.join(tempRoot, "eval-harness-smoke-"));

  try {
    const sample = {
      id: "smoke-echo",
      name: "Smoke echo test",
      category: "smoke",
      command,
      expect: { type: "contains" as const, value: "hello" },
    };

    fs.writeFileSync(path.join(tmpDir, "smoke.yaml"), JSON.stringify(sample));
    return await runEvalSuite(parseEvalSuite(tmpDir));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
