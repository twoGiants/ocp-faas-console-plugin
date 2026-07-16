#!/usr/bin/env bash
set -euo pipefail

# Used by .claude/commands/begin.md slash command.

dry_run=false
input=""

for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    dry_run=true
  else
    input="$arg"
  fi
done

# Check jira CLI
if ! command -v jira &>/dev/null; then
  echo "Error: jira CLI is not installed."
  echo "Install: https://github.com/ankitpokhrel/jira-cli#installation"
  exit 1
fi

# Validate argument
if [ -z "$input" ]; then
  echo "Usage: ./hack/branch.sh [--dry-run] <JIRA-TICKET-OR-URL>"
  echo "Examples:"
  echo "  ./hack/branch.sh SRVOCF-986"
  echo "  ./hack/branch.sh --dry-run SRVOCF-986"
  exit 1
fi

# Extract ticket ID from URL or plain ID
ticket=$(echo "$input" | grep -oE '[A-Z]+-[0-9]+' || true)
if [ -z "$ticket" ]; then
  echo "Error: not a valid Jira ticket. Expected format: SRVOCF-123 or a Jira URL."
  exit 1
fi

# Check current branch
current=$(git rev-parse --abbrev-ref HEAD)

# Already on a feature branch for this ticket
if echo "$current" | grep -qE "^${ticket}-"; then
  echo "INFO: Already on feature branch for $ticket: $current"
  exit 0
fi

# On a different feature branch
if echo "$current" | grep -qE '^[A-Z]+-[0-9]+'; then
  echo "WARNING: Currently on branch '$current'."
  echo "Checkout master first and run /begin $ticket again."
  exit 1
fi

# On master: generate the branch name
title=$(jira issue view "$ticket" --plain --comments 0 2>/dev/null \
  | grep '^  # ' \
  | sed 's/^  # //' \
  | xargs)

if [ -z "$title" ]; then
  echo "Error: could not read title for $ticket."
  exit 1
fi

slug=$(echo "$title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed 's/[^a-z0-9 ]//g' \
  | tr -s ' ' '-')

branch="$ticket-$slug"

if [ ${#branch} -gt 90 ]; then
  branch=$(echo "$branch" | cut -c1-90 | sed 's/-[^-]*$//')
fi

if [ "$dry_run" = true ]; then
  echo "git checkout -b $branch"
else
  git checkout -b "$branch"
fi
