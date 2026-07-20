#!/usr/bin/env bash
set -euo pipefail

# Used by .claude/commands/commit.md slash command.
# Parses arguments and returns MODE (commit or dry-run) and TICKET.
#
# Usage:
#   ./hack/parse-commit-args.sh                    # MODE: commit, TICKET: none
#   ./hack/parse-commit-args.sh --dry-run           # MODE: dry-run, TICKET: none
#   ./hack/parse-commit-args.sh SRVOCF-986          # MODE: commit, TICKET: SRVOCF-986
#   ./hack/parse-commit-args.sh --dry-run SRVOCF-986 # MODE: dry-run, TICKET: SRVOCF-986

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
