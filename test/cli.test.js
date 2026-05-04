import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);

async function runCli(args, home) {
  return execFileAsync("node", ["bin/turn-shift.js", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: home },
  });
}

describe("turn-shift CLI", () => {
  it("updates an existing skill install without requiring --force", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "turn-shift-cli-home-"));
    const skillPath = path.join(home, ".agents", "skills", "turn-shift", "SKILL.md");

    try {
      await runCli(["install", "codex"], home);
      await writeFile(skillPath, "local edit\n");

      const { stdout } = await runCli(["update", "codex"], home);
      const skill = await readFile(skillPath, "utf8");

      assert.match(stdout, /Updated turn-shift for codex:/);
      assert.match(skill, /name: turn-shift/);
      assert.doesNotMatch(skill, /local edit/);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("supports turn-shift-update as an update alias", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "turn-shift-cli-home-"));
    const binDir = await mkdtemp(path.join(tmpdir(), "turn-shift-cli-bin-"));
    const alias = path.join(binDir, "turn-shift-update");
    const skillPath = path.join(home, ".claude", "skills", "turn-shift", "SKILL.md");

    try {
      await symlink(path.join(process.cwd(), "bin", "turn-shift.js"), alias);
      await runCli(["claude"], home);
      await writeFile(skillPath, "local edit\n");

      const { stdout } = await execFileAsync("node", [alias, "claude"], {
        cwd: process.cwd(),
        env: { ...process.env, HOME: home },
      });
      const skill = await readFile(skillPath, "utf8");

      assert.match(stdout, /Updated turn-shift for claude:/);
      assert.match(skill, /name: turn-shift/);
    } finally {
      await rm(home, { recursive: true, force: true });
      await rm(binDir, { recursive: true, force: true });
    }
  });
});
