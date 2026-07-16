#!/usr/bin/env bash
set -euo pipefail

# Used by .claude/commands/commit.md slash command.

mode="commit"
ticket="none"

for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    mode="dry-run"
  elif [[ "$arg" =~ ^[A-Z]+-[0-9]+$ ]]; then
    ticket="$arg"
  elif [[ "$arg" =~ ([A-Z]+-[0-9]+) ]]; then
    ticket="${BASH_REMATCH[1]}"
  fi
done

echo "MODE: $mode"
echo "TICKET: $ticket"
