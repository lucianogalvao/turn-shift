# Turn Shift

Turn Shift installs local agent skills that let Codex and Claude recover recent work from each other's session logs.

## Install

Use the package directly:

```bash
npx @lucianogalvao/turn-shift@latest install codex
npx @lucianogalvao/turn-shift@latest install claude
```

Or install the CLI globally:

```bash
npm install -g @lucianogalvao/turn-shift@latest
turn-shift install codex
turn-shift install claude
```

## Update

After a new package version is published, update the installed local skills from the latest npm package:

```bash
npx @lucianogalvao/turn-shift@latest update codex
npx @lucianogalvao/turn-shift@latest update claude
```

If you use the global CLI, update the global package first, then update the local skill install:

```bash
npm install -g @lucianogalvao/turn-shift@latest
turn-shift update codex
turn-shift update claude
```

## What Gets Installed

For Codex:

```text
~/.agents/skills/turn-shift
```

For Claude:

```text
~/.claude/skills/turn-shift
```

The npm package does not use `postinstall` and does not modify agent directories unless you run the install command explicitly.

## Usage

In Codex, mention the installed skill with `$turn-shift` to read Claude Code sessions:

```text
$turn-shift claude
$turn-shift claude -m "message text"
$turn-shift claude <session-hash>
$turn-shift claude --session <session-hash>
```

In Claude, use the installed skill to read Codex sessions:

```text
/turn-shift codex
/turn-shift codex -m "message text"
/turn-shift codex <session-hash>
/turn-shift codex --session <session-hash>
```

When multiple sessions match a message search, Turn Shift lists up to three candidates with a title, summary, session hash, source, and match excerpt. After that list appears, run again with the candidate number to load that result:

```text
$turn-shift 1
/turn-shift 1
```

You can also load a specific session directly with the provider plus session hash, or provider plus `--session <hash>`.

## Development

```bash
npm test
npm run pack:dry
```

Python scripts can be syntax-checked with:

```bash
PYTHONPYCACHEPREFIX=/tmp python3 -m py_compile skills/codex/scripts/turn_shift.py skills/claude/scripts/turn_shift.py
```

## Security

Turn Shift reads local agent session logs. Review output before sharing it publicly because transcripts may include file paths, commands, errors, prompts, and other private context.
