import { constants } from "node:fs";
import { access, cp, readdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillName = "turn-shift";

const targets = {
  codex: [".agents", "skills", skillName],
  claude: [".claude", "skills", skillName],
};

export function resolveInstallTarget(agent, home = homedir()) {
  const normalized = normalizeAgent(agent);
  const targetParts = targets[normalized];
  if (!targetParts) {
    throw new Error("Unsupported agent. Use `codex` or `claude`.");
  }
  return path.join(home, ...targetParts);
}

export async function installSkill({ agent, home = homedir(), force = false } = {}) {
  const normalized = normalizeAgent(agent);
  const source = path.join(packageRoot, "skills", normalized);
  const target = resolveInstallTarget(normalized, home);

  await assertExists(source, `Missing bundled skill for ${normalized}.`);

  if (await pathExists(target)) {
    if (!force) {
      throw new Error(`${target} already exists. Re-run with --force to overwrite it.`);
    }
    await rm(target, { recursive: true, force: true });
  }

  await cp(source, target, { recursive: true, preserveTimestamps: true });

  return {
    agent: normalized,
    target,
    files: await listRelativeFiles(target),
  };
}

function normalizeAgent(agent) {
  return String(agent || "").trim().toLowerCase();
}

async function pathExists(target) {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function assertExists(target, message) {
  if (!(await pathExists(target))) {
    throw new Error(message);
  }
}

async function listRelativeFiles(root, prefix = "") {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRelativeFiles(root, relative));
      continue;
    }
    if (entry.isFile()) {
      files.push(relative);
    }
  }
  return files.sort();
}
