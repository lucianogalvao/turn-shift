# Turn Shift

Turn Shift installs local agent skills that let Codex and Claude recover recent work from each other's session logs.

## Install

Use the package directly:

```bash
npx @lucianogalvao/turn-shift install codex
npx @lucianogalvao/turn-shift install claude
```

Or install the CLI globally:

```bash
npm install -g @lucianogalvao/turn-shift
turn-shift install codex
turn-shift install claude
```

Use `--force` to replace an existing local skill install:

```bash
turn-shift install codex --force
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

In Codex, use the installed skill to read Claude Code sessions:

```text
/turn-shift claude
/turn-shift claude -m "message text"
```

In Claude, use the installed skill to read Codex sessions:

```text
/turn-shift codex
/turn-shift codex -m "message text"
```

When multiple sessions match a message search, Turn Shift lists up to three candidates. Run again with `--session <hash>` to load a specific session.

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
