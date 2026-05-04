import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, it } from "node:test";

const execFileAsync = promisify(execFile);

async function runScript(script, args, home) {
  const result = await execFileAsync("python3", [script, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, HOME: home },
  });
  return result.stdout;
}

async function runScriptFailure(script, args, home) {
  await assert.rejects(
    () => execFileAsync("python3", [script, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home },
    }),
    /Unsupported provider|No .* sessions found/,
  );
}

async function writeJsonl(filePath, rows) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function encodedProjectPath(cwd) {
  return cwd.replaceAll("/", "-");
}

describe("Codex turn_shift.py reading Claude sessions", () => {
  it("renders summaries in match lists and loads a selected session by number or hash", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "turn-shift-script-home-"));
    const cwd = "/tmp/sample-app";
    const projectDir = path.join(home, ".claude", "projects", encodedProjectPath(cwd));
    const firstSession = "11111111-1111-4111-8111-111111111111";
    const secondSession = "22222222-2222-4222-8222-222222222222";

    try {
      const firstPath = path.join(projectDir, `${firstSession}.jsonl`);
      const secondPath = path.join(projectDir, `${secondSession}.jsonl`);

      await writeJsonl(firstPath, [
        { type: "user", message: { role: "user", content: "Build app onboarding flow.\n\nMake the welcome copy multiline." } },
        { type: "assistant", message: { role: "assistant", content: "Implemented onboarding with multiline welcome copy." } },
      ]);
      await writeJsonl(secondPath, [
        { type: "user", message: { role: "user", content: "Fix app billing export." } },
        { type: "assistant", message: { role: "assistant", content: "Fixed the billing export path." } },
      ]);
      await utimes(firstPath, new Date("2026-05-04T11:00:00Z"), new Date("2026-05-04T11:00:00Z"));
      await utimes(secondPath, new Date("2026-05-04T10:00:00Z"), new Date("2026-05-04T10:00:00Z"));

      const searchOutput = await runScript("skills/codex/scripts/turn_shift.py", ["claude", "--cwd", cwd, "-m", "app"], home);

      assert.match(searchOutput, /1\. \[/);
      assert.match(searchOutput, /Summary: Build app onboarding flow\. Make the welcome copy multiline\./);
      assert.match(searchOutput, /Run again with `1`, `claude <session hash>`, or `claude --session <hash>`/);

      const byNumber = await runScript("skills/codex/scripts/turn_shift.py", ["1", "--cwd", cwd], home);

      assert.match(byNumber, new RegExp(`Session hash: \`${firstSession}\``));
      assert.match(byNumber, /# Conversation/);

      await runScriptFailure("skills/codex/scripts/turn_shift.py", [secondSession, "--cwd", cwd], home);

      const byHash = await runScript("skills/codex/scripts/turn_shift.py", ["claude", secondSession, "--cwd", cwd], home);

      assert.match(byHash, new RegExp(`Session hash: \`${secondSession}\``));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});

describe("Claude turn_shift.py reading Codex sessions", () => {
  it("renders summaries in match lists and loads a selected session by number or hash", async () => {
    const home = await mkdtemp(path.join(tmpdir(), "turn-shift-script-home-"));
    const cwd = "/tmp/sample-app";
    const sessionsDir = path.join(home, ".codex", "sessions", "2026", "05", "04");
    const firstSession = "33333333-3333-4333-8333-333333333333";
    const secondSession = "44444444-4444-4444-8444-444444444444";

    try {
      const firstPath = path.join(sessionsDir, `${firstSession}.jsonl`);
      const secondPath = path.join(sessionsDir, `${secondSession}.jsonl`);

      await writeJsonl(firstPath, [
        { type: "session_meta", payload: { id: firstSession, cwd, timestamp: "2026-05-04T10:00:00Z" } },
        { type: "user_message", payload: { message: "Build app onboarding flow.\n\nMake the welcome copy multiline." } },
        { type: "assistant_message", payload: { message: "Implemented onboarding with multiline welcome copy." } },
      ]);
      await writeJsonl(secondPath, [
        { type: "session_meta", payload: { id: secondSession, cwd, timestamp: "2026-05-04T11:00:00Z" } },
        { type: "user_message", payload: { message: "Fix app billing export." } },
        { type: "assistant_message", payload: { message: "Fixed the billing export path." } },
      ]);
      await utimes(firstPath, new Date("2026-05-04T11:00:00Z"), new Date("2026-05-04T11:00:00Z"));
      await utimes(secondPath, new Date("2026-05-04T10:00:00Z"), new Date("2026-05-04T10:00:00Z"));

      const searchOutput = await runScript("skills/claude/scripts/turn_shift.py", ["codex", "--cwd", cwd, "-m", "app"], home);

      assert.match(searchOutput, /1\. \[/);
      assert.match(searchOutput, /Summary: Build app onboarding flow\. Make the welcome copy multiline\./);
      assert.match(searchOutput, /Run again with `1`, `codex <session hash>`, or `codex --session <hash>`/);

      const byNumber = await runScript("skills/claude/scripts/turn_shift.py", ["1", "--cwd", cwd], home);

      assert.match(byNumber, new RegExp(`Session hash: \`${firstSession}\``));
      assert.match(byNumber, /# Conversation/);

      await runScriptFailure("skills/claude/scripts/turn_shift.py", [secondSession, "--cwd", cwd], home);

      const byHash = await runScript("skills/claude/scripts/turn_shift.py", ["codex", secondSession, "--cwd", cwd], home);

      assert.match(byHash, new RegExp(`Session hash: \`${secondSession}\``));
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
