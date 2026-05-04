#!/usr/bin/env node

import { installSkill } from "../lib/install.js";

const usage = `Usage:
  turn-shift install <codex|claude> [--force]
  turn-shift-install <codex|claude> [--force]

Installs the Turn Shift skill for the selected agent.`;

async function main(argv) {
  const args = [...argv];
  const command = args[0] === "install" ? args.shift() : "install";
  const forceIndex = args.indexOf("--force");
  const force = forceIndex !== -1;
  if (force) {
    args.splice(forceIndex, 1);
  }

  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage);
    return 0;
  }

  if (command !== "install" || args.length !== 1) {
    console.error(usage);
    return 2;
  }

  const result = await installSkill({ agent: args[0], force });
  console.log(`Installed turn-shift for ${result.agent}: ${result.target}`);
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
