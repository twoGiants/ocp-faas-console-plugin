#!/usr/bin/env bash
set -euo pipefail

# For pi users to keep the claude slash commands in sync with pi prompt templates.
# Recreates all symlinks in .pi/prompts/ from .claude/commands/.
#
# Usage:
#   ./hack/update-pi-prompt-symlinks.sh

cd .pi/prompts

rm -f *.md

for f in ../../.claude/commands/*.md; do
  [ -e "$f" ] || continue
  ln -s "$f" "$(basename "$f")"
done
