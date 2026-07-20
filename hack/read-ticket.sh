#!/usr/bin/env bash
set -euo pipefail

# Used by .claude/commands/begin.md slash command.
# Reads a Jira ticket and outputs status with a recommended action.
# Falls back to extracting the ticket ID from the current branch name.
#
# Usage:
#   ./hack/read-ticket.sh                          # detect from current branch
#   ./hack/read-ticket.sh SRVOCF-986               # read specific ticket
#   ./hack/read-ticket.sh https://redhat.atlassian.net/browse/SRVOCF-986  # accepts URLs

if ! command -v jira &>/dev/null; then
  echo "Error: jira CLI is not installed."
  echo "Install: https://github.com/ankitpokhrel/jira-cli#installation"
  exit 1
fi

# Parse arguments (ignore --dry-run which can come from the begin.md args)
input=""
for arg in "$@"; do
  if [ "$arg" != "--dry-run" ]; then
    input="$arg"
  fi
done

# Fall back to branch name
if [ -z "$input" ]; then
  input=$(git rev-parse --abbrev-ref HEAD | grep -oE '^[A-Z]+-[0-9]+' || true)
fi

if [ -z "$input" ]; then
  echo "Error: no ticket provided and not on a feature branch."
  echo "Usage: ./hack/read-ticket.sh [JIRA-TICKET]"
  exit 1
fi

# Extract ticket ID if URL was passed
ticket=$(echo "$input" | grep -oE '[A-Z]+-[0-9]+' || true)
if [ -z "$ticket" ]; then
  echo "Error: not a valid Jira ticket."
  exit 1
fi

# Read ticket
output=$(jira issue view "$ticket" 2>/dev/null)
if [ -z "$output" ]; then
  echo "Error: could not read ticket $ticket."
  exit 1
fi

echo "$output"
echo ""

# Detect status from jira output
if echo "$output" | grep -qE '🚧 In Progress|🚧 Backlog'; then
  echo "REFINED: true"
  echo "ACTION: Ask the user if you should start planning/brainstorming for the implementation."
elif echo "$output" | grep -qE '🚧 New'; then
  echo "REFINED: false"
  echo "ACTION: Ask the user if you should start refining this ticket together."
fi
