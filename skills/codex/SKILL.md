---
name: turn-shift
description: Use when the user invokes /turn-shift, asks to continue work from another LLM session, or needs recent Claude Code conversation context after token exhaustion.
---

# Turn Shift

Use this to take over work from a recent LLM session, especially Claude Code.

## Trigger

When the user writes `$turn-shift LLM`, treat `LLM` as the source provider.
After a multiple-session result, when the user writes `$turn-shift N`, treat `N` as the number of a candidate from that last result.
When the user writes `$turn-shift claude HASH`, treat `HASH` as a Claude session hash.

Supported provider:
- `claude`

If no provider is given, ask for one. If the provider is unsupported, say that only Claude is supported for now.

## Workflow

1. Run the bundled script from this skill:

   ```bash
   python3 ~/.agents/skills/turn-shift/scripts/turn_shift.py claude --cwd "$PWD"
   ```

   To search sessions from the named provider by message text:

   ```bash
   python3 ~/.agents/skills/turn-shift/scripts/turn_shift.py claude --cwd "$PWD" -m "message text"
   ```

   After a multiple-session result, to load a candidate from that last result by number:

   ```bash
   python3 ~/.agents/skills/turn-shift/scripts/turn_shift.py 1 --cwd "$PWD"
   ```

   To load a specific session by hash:

   ```bash
   python3 ~/.agents/skills/turn-shift/scripts/turn_shift.py claude <hash> --cwd "$PWD"
   python3 ~/.agents/skills/turn-shift/scripts/turn_shift.py claude --cwd "$PWD" --session <hash>
   ```

2. Return the script output to the user. Transcript output includes:
   - session hash
   - title
   - summary capped at 250 characters
   - source file
   - full conversation transcript suitable for continuing the task

3. After returning the transcript, be ready to continue the requested work using that context.

## Rules

- Without `-m/--message`, prefer the latest Claude session for the current working directory.
- With `-m/--message`, search sessions from the named provider for that text.
- If one session matches `-m/--message`, return its transcript.
- If multiple sessions match `-m/--message`, return up to 3 candidate sessions with titles, summaries, session hashes, sources, and match excerpts.
- If the user responds with a number, run the script with that number to load the matching candidate from the last result.
- If the user responds with a hash, run the script with the provider and hash or `claude --session <hash>`.
- Ignore Claude subagent transcripts unless the user explicitly asks for subagents.
- Do not invent missing context. If the script cannot find a session, report that directly.
- Preserve file paths, commands, errors, and user decisions exactly when they appear.
- Keep the `summary` line at or under 250 characters.
