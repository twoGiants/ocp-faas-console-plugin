#!/usr/bin/env bash
set -euo pipefail

# Used by .claude/command/commit.md slash command.

mode="commit"
ticket="none"

for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    mode="dry-run"
  elif echo "$arg" | grep -qE '^[A-Z]+-[0-9]+$'; then
    ticket="$arg"
  elif echo "$arg" | grep -qoE '[A-Z]+-[0-9]+'; then
    ticket=$(echo "$arg" | grep -oE '[A-Z]+-[0-9]+')
  fi
done

echo "MODE: $mode"
echo "TICKET: $ticket"
