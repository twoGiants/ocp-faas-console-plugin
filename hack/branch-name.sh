#!/usr/bin/env bash
set -euo pipefail

# Used by .claude/command/begin.md slash command.

# Check if already on a feature branch
current=$(git rev-parse --abbrev-ref HEAD)
if echo "$current" | grep -qE '^[A-Z]+-[0-9]+'; then
  echo "Already on feature branch: $current"
  exit 0
fi

# Check jira CLI
if ! command -v jira &>/dev/null; then
  echo "Error: jira CLI is not installed."
  echo "Install: https://github.com/ankitpokhrel/jira-cli#installation"
  exit 1
fi

# Validate argument
input="${1:-}"
if [ -z "$input" ]; then
  echo "Usage: ./hack/branch-name.sh <JIRA-TICKET-OR-URL>"
  echo "Examples:"
  echo "  ./hack/branch-name.sh SRVOCF-986"
  echo "  ./hack/branch-name.sh https://redhat.atlassian.net/browse/SRVOCF-986"
  exit 1
fi

# Extract ticket ID from URL or plain ID
ticket=$(echo "$input" | grep -oE '[A-Z]+-[0-9]+' || true)
if [ -z "$ticket" ]; then
  echo "Error: not a valid Jira ticket. Expected format: SRVOCF-123 or a Jira URL."
  exit 1
fi

# Fetch ticket title
title=$(jira issue view "$ticket" --plain --comments 0 2>/dev/null \
  | grep '^  # ' \
  | sed 's/^  # //' \
  | xargs)

if [ -z "$title" ]; then
  echo "Error: could not read title for $ticket."
  exit 1
fi

# Build branch name: lowercase, no punctuation, dash-separated
slug=$(echo "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9 ]//g' \
  | tr -s ' ' '-')

branch="$ticket-$slug"

# Truncate to 90 chars without breaking a word
if [ ${#branch} -gt 90 ]; then
  branch=$(echo "$branch" | cut -c1-91 | sed 's/-[^-]*$//')
fi

echo "git checkout -b $branch"
