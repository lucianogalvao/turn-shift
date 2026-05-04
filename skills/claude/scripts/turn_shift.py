#!/usr/bin/env python3
"""Extract a recent Codex conversation for handoff to another agent."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


SUMMARY_LIMIT = 250
MAX_TEXT_FIELD = 20000
MATCH_LIMIT = 3
MATCH_CONTEXT = 80


@dataclass(frozen=True)
class Session:
    path: Path
    session_id: str
    mtime: float
    cwd: str | None = None
    timestamp: str | None = None


@dataclass
class Turn:
    role: str
    text: str


@dataclass
class SessionMatch:
    session: Session
    turns: list[Turn]
    excerpt: str


def find_codex_sessions(cwd: Path | None) -> list[Session]:
    codex_sessions = Path.home() / ".codex" / "sessions"
    if not codex_sessions.exists():
        return []

    sessions: list[Session] = []
    for path in codex_sessions.glob("**/*.jsonl"):
        try:
            session = session_from_path(path)
        except OSError:
            continue
        sessions.append(session)

    if cwd:
        resolved = str(cwd.resolve())
        scoped = [session for session in sessions if session.cwd == resolved]
        if scoped:
            sessions = scoped

    return sorted(sessions, key=lambda item: item.mtime, reverse=True)


def session_from_path(path: Path) -> Session:
    session_id = path.stem
    timestamp: str | None = None
    cwd: str | None = None

    for row in load_jsonl(path):
        if row.get("type") != "session_meta":
            continue
        payload = row.get("payload")
        if not isinstance(payload, dict):
            continue
        session_id = str(payload.get("id") or session_id)
        timestamp = str(payload.get("timestamp") or "") or None
        cwd = str(payload.get("cwd") or "") or None
        break

    return Session(path=path, session_id=session_id, mtime=path.stat().st_mtime, cwd=cwd, timestamp=timestamp)


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def extract_turns(rows: list[dict[str, Any]]) -> list[Turn]:
    turns: list[Turn] = []
    for row in rows:
        row_type = row.get("type")
        payload = row.get("payload")
        if not isinstance(payload, dict):
            continue

        role, content = role_and_content(row_type, payload)
        if role is None:
            continue

        text = normalize_text(content_to_text(content))
        if not text:
            continue
        if len(text) > MAX_TEXT_FIELD:
            text = text[:MAX_TEXT_FIELD].rstrip() + "\n[...truncated long field...]"
        turns.append(Turn(role=role, text=text))
    return turns


def role_and_content(row_type: Any, payload: dict[str, Any]) -> tuple[str | None, Any]:
    if row_type in {"user_message", "user"}:
        return "user", payload.get("message") or payload.get("content") or payload.get("text")
    if row_type in {"assistant_message", "assistant"}:
        return "assistant", payload.get("message") or payload.get("content") or payload.get("text")

    message = payload.get("message")
    if isinstance(message, dict):
        role = message.get("role")
        if role in {"user", "assistant"}:
            return str(role), message.get("content")

    if row_type in {"response_item", "event"}:
        item = payload.get("item") or payload.get("event") or payload
        if isinstance(item, dict):
            role = item.get("role")
            if role in {"user", "assistant"}:
                return str(role), item.get("content") or item.get("text")
            item_type = item.get("type")
            if item_type == "function_call":
                return "assistant", f"[tool_use:{item.get('name', 'tool')}] {compact_json(item.get('arguments'))}"
            if item_type == "function_call_output":
                return "tool", f"[tool_result] {content_to_text(item.get('output'))}"

    return None, None


def content_to_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                item_type = item.get("type")
                if item_type in {"input_text", "output_text", "text"} and item.get("text"):
                    parts.append(str(item["text"]))
                elif item_type in {"tool_use", "function_call"}:
                    parts.append(f"[tool_use:{item.get('name', 'tool')}] {compact_json(item.get('input') or item.get('arguments'))}")
                elif item_type in {"tool_result", "function_call_output"}:
                    parts.append(f"[tool_result] {content_to_text(item.get('content') or item.get('output'))}")
                elif "content" in item:
                    parts.append(content_to_text(item["content"]))
                elif "text" in item:
                    parts.append(str(item["text"]))
        return "\n".join(part for part in parts if part)
    if isinstance(content, dict):
        if "text" in content:
            return str(content["text"])
        if "content" in content:
            return content_to_text(content["content"])
        return compact_json(content)
    return str(content)


def compact_json(value: Any) -> str:
    if value is None:
        return ""
    try:
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    except TypeError:
        return str(value)


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def title_from_turns(turns: list[Turn], session_id: str) -> str:
    for turn in turns:
        if turn.role != "user":
            continue
        text = strip_noise(turn.text)
        if text:
            title = first_sentence(text)
            return truncate_chars(title, 80)
    return f"Codex session {session_id[:8]}"


def summary_from_turns(turns: list[Turn]) -> str:
    user_texts = [strip_noise(t.text) for t in turns if t.role == "user"]
    assistant_texts = [t.text for t in turns if t.role == "assistant"]
    seeds = [t for t in user_texts if t]
    if assistant_texts:
        seeds.append(assistant_texts[-1])
    source = " ".join(seeds) if seeds else "Codex session context ready for takeover."
    summary = re.sub(r"\s+", " ", source).strip()
    return truncate_chars(summary, SUMMARY_LIMIT)


def strip_noise(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def first_sentence(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    match = re.search(r"(.{20,}?[.!?])\s", text)
    if match:
        return match.group(1)
    return text


def truncate_chars(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def render(session: Session, turns: list[Turn]) -> str:
    title = title_from_turns(turns, session.session_id)
    summary = summary_from_turns(turns)
    transcript = "\n\n".join(f"## {turn.role}\n\n{turn.text}" for turn in turns)
    return "\n".join(
        [
            "# Turn Shift: Codex",
            "",
            f"- Session hash: `{session.session_id}`",
            f"- Title: {title}",
            f"- Summary: {summary}",
            f"- Source: `{session.path}`",
            "",
            "# Conversation",
            "",
            transcript or "_No user/assistant messages found in this session._",
            "",
        ]
    )


def find_message_match(turns: list[Turn], query: str) -> str | None:
    needle = query.casefold().strip()
    if not needle:
        return None

    for turn in turns:
        haystack = turn.text
        index = haystack.casefold().find(needle)
        if index == -1:
            continue
        return excerpt_around(haystack, index, len(query))

    return None


def excerpt_around(text: str, start: int, length: int) -> str:
    left = max(0, start - MATCH_CONTEXT)
    right = min(len(text), start + length + MATCH_CONTEXT)
    excerpt = text[left:right]
    excerpt = re.sub(r"\s+", " ", excerpt).strip()
    if left > 0:
        excerpt = "..." + excerpt
    if right < len(text):
        excerpt = excerpt + "..."
    return excerpt


def find_session_matches(sessions: list[Session], query: str) -> list[SessionMatch]:
    matches: list[SessionMatch] = []
    for session in sessions:
        rows = load_jsonl(session.path)
        turns = extract_turns(rows)
        excerpt = find_message_match(turns, query)
        if excerpt is None:
            continue
        matches.append(SessionMatch(session=session, turns=turns, excerpt=excerpt))
        if len(matches) >= MATCH_LIMIT:
            break
    return matches


def render_matches(provider: str, query: str, matches: list[SessionMatch]) -> str:
    provider_name = provider.capitalize()
    lines = [f"Found {len(matches)} matching {provider_name} sessions for message `{query}`:", ""]
    for index, match in enumerate(matches, start=1):
        timestamp = datetime.fromtimestamp(match.session.mtime).strftime("%Y-%m-%d %H:%M")
        title = title_from_turns(match.turns, match.session.session_id)
        lines.extend(
            [
                f"{index}. [{timestamp}] {title}",
                f"   Session: {match.session.session_id}",
                f"   Source: `{match.session.path}`",
                f"   Match: \"{match.excerpt}\"",
                "",
            ]
        )
    lines.extend(["Run again with `--session <hash>` to load one of these sessions.", ""])
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract latest LLM session for turn shift.")
    parser.add_argument("provider", help="Source provider. Currently supported: codex")
    parser.add_argument("--cwd", default=os.getcwd(), help="Project directory used to prefer matching sessions")
    parser.add_argument("--session", help="Specific session hash to load instead of the latest")
    parser.add_argument("-m", "--message", help="Search sessions for this message text before loading")
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    provider = args.provider.lower().strip()
    if provider != "codex":
        print("Unsupported provider. Only `codex` is supported for now.", file=sys.stderr)
        return 2

    cwd = Path(args.cwd).expanduser() if args.cwd else None
    sessions = find_codex_sessions(cwd)
    if args.session:
        sessions = [session for session in sessions if session.session_id == args.session]

    if not sessions:
        scope = f" for cwd `{cwd}`" if cwd else ""
        print(f"No Codex sessions found{scope}.", file=sys.stderr)
        return 1

    if args.message:
        matches = find_session_matches(sessions, args.message)
        if not matches:
            scope = f" for cwd `{cwd}`" if cwd else ""
            print(f"No Codex sessions found matching message `{args.message}`{scope}.", file=sys.stderr)
            return 1
        if len(matches) == 1:
            match = matches[0]
            print(render(match.session, match.turns))
            return 0

        print(render_matches(provider, args.message, matches))
        return 0

    session = sessions[0]
    rows = load_jsonl(session.path)
    turns = extract_turns(rows)
    print(render(session, turns))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
