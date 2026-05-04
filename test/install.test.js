import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import { installSkill, resolveInstallTarget } from "../lib/install.js";

describe("resolveInstallTarget", () => {
  it("maps codex to ~/.agents/skills/turn-shift", () => {
    const target = resolveInstallTarget("codex", "/tmp/home");

    assert.equal(target, "/tmp/home/.agents/skills/turn-shift");
  });

  it("maps claude to ~/.claude/skills/turn-shift", () => {
    const target = resolveInstallTarget("claude", "/tmp/home");

    assert.equal(target, "/tmp/home/.claude/skills/turn-shift");
  });

  it("rejects unsupported agents", () => {
    assert.throws(() => resolveInstallTarget("gemini", "/tmp/home"), /Unsupported agent/);
  });
});

describe("installSkill", () => {
  it("copies the selected skill into the agent skill directory", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "turn-shift-home-"));
    try {
      const result = await installSkill({ agent: "codex", home });

      assert.equal(result.agent, "codex");
      assert.equal(result.target, path.join(home, ".agents", "skills", "turn-shift"));
      assert.equal(result.files.length > 0, true);

      const skill = await readFile(path.join(result.target, "SKILL.md"), "utf8");
      const script = await stat(path.join(result.target, "scripts", "turn_shift.py"));

      assert.match(skill, /name: turn-shift/);
      assert.equal(script.isFile(), true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it("does not overwrite existing installs unless force is true", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "turn-shift-home-"));
    try {
      await installSkill({ agent: "claude", home });

      await assert.rejects(
        () => installSkill({ agent: "claude", home }),
        /already exists/,
      );

      const result = await installSkill({ agent: "claude", home, force: true });

      assert.equal(result.agent, "claude");
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
