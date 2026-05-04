#!/usr/bin/env node

import path from "node:path";

import { installSkill } from "../lib/install.js";

const usage = `Usage:
  turn-shift install <codex|claude> [--force]
  turn-shift update <codex|claude>
  turn-shift-install <codex|claude> [--force]
  turn-shift-update <codex|claude>

Installs or updates the Turn Shift skill for the selected agent.`;

async function main(argv) {
  const args = [...argv];
  const executable = path.basename(process.argv[1] || "");
  const defaultCommand = executable === "turn-shift-update" ? "update" : "install";
  const command = ["install", "update"].includes(args[0]) ? args.shift() : defaultCommand;
  const forceIndex = args.indexOf("--force");
  const force = command === "update" || forceIndex !== -1;
  if (forceIndex !== -1) {
    args.splice(forceIndex, 1);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return 0;
  }

  if (!["install", "update"].includes(command) || args.length !== 1) {
    console.error(usage);
    return 2;
  }

  const result = await installSkill({ agent: args[0], force });
  const verb = command === "update" ? "Updated" : "Installed";
  console.log(`${verb} turn-shift for ${result.agent}: ${result.target}`);
  for (const file of result.files) {
    console.log(`- ${file}`);
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
