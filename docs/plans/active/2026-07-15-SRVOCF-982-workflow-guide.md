# SRVOCF-982: Workflow Guide Implementation Plan

**Goal:** Clean up PoC-era workflow artifacts, establish Jira-linked branch naming, and consolidate workflow documentation into `docs/workflow-guide.md`.

**Jira:** [SRVOCF-982](https://redhat.atlassian.net/browse/SRVOCF-982) (Section 2 only)

**Branch:** `SRVOCF-982-workflow-guide-part-1-cleanup`

---

## TODO

- [x] Task 1: Delete PoC artifact files
- [x] Task 2: Remove PoC artifact references from project docs
- [x] Task 3: Simplify slash commands (begin/commit)
- [ ] Task 4: Write `docs/workflow-guide.md`
- [x] Task 5: ~~Update `docs/WORKFLOW.md`~~ (superseded, file deleted per review)
- [ ] Task 6: Branch name validation script
- [ ] Task 7: Add branch name lint to Husky pre-push hook
- [ ] Task 8: Add branch name and commit message lint to CI

---

## Task 1: Delete PoC artifact files

Delete these 7 files that served the PoC-era agent workflow:

```
docs/agent-struggles.json
docs/features.json
docs/potential-features.json
docs/claude-progress.txt
docs/references/agent-struggles-readme.md
docs/references/claude-progress-readme.md
docs/references/features-json-readme.md
```

Also delete the now-obsolete branch numbering script:

```
hack/next-plan-number.sh
```

Commit: `chore: remove PoC-era workflow artifacts`

---

## Task 2: Remove PoC artifact references from project docs

Update these files to remove references to deleted files:

**`AGENTS.md`** — Remove these rows from the Knowledge Base table:
- `docs/features.json`
- `docs/potential-features.json`
- `docs/claude-progress.txt`
- `docs/agent-struggles.json`

**`docs/WORKFLOW.md`** — Remove:
- References to `features.json` in the Feature Development Sequence (step 2, step 6)
- Reference to `claude-progress.txt` in step 6 and Session Rules
- Reference to `agent-struggles.json` in Continuous Improvement section
- The `hack/next-plan-number.sh` reference in Branching section

**`docs/TESTING.md`** — Remove:
- `features.json` reference in the E2e test layer description ("Validate features.json entries")
- Replace with "Validate user flows in real browser"

**Do not touch** `docs/design/` files (they are historical records).

Commit: `chore: remove references to deleted PoC artifacts`

---

## Task 3: Simplify slash commands (begin/commit)

Current commands in `.claude/commands/`:
- `init-session.md` (session start, reads PoC artifacts, picks from Jira epic)
- `session-commit.md` (end-of-session commit)
- `e2e.md` (e2e test scaffolding, keep as-is)
- `scrutinise.md` (self-review, keep as-is)

**Changes:**

**Rename `init-session.md` to `begin.md`** and simplify:
- Remove steps that reference deleted files (features.json, claude-progress.txt, agent-struggles.json)
- Remove the "create feature entry in features.json" step
- Keep: orient (git log), pick story from Jira
- Simplify the "pick story" step: accept optional Jira ticket argument

**Rename `session-commit.md` to `commit.md`** and update:
- Add `--dry-run` flag support via `hack/parse-commit-args.sh`
- Add optional Jira ticket argument for issue references

Commit: `chore: simplify slash commands to begin/commit`

---

## Task 4: Write `docs/workflow-guide.md`

Create the consolidated workflow guide. Content sources:
- Branch naming: new Jira-linked convention
- Commit messages: `.claude/commands/commit.md` (link, don't duplicate)
- PR guidelines: from PR template and team conventions

Structure:

```markdown
# Workflow Guide

## Branch Naming

Format: `<JIRA-ID>-<short-description>`

- `<JIRA-ID>`: Jira ticket key, e.g. `SRVOCF-982`
- `<short-description>`: lowercase, hyphen-separated, 2-5 words

Examples:
- `SRVOCF-982-workflow-guide-cleanup`
- `SRVOCF-850-editor-layout-ux`

Every branch must link to a Jira ticket.

## Commit Messages

Follow [`.claude/commands/commit.md`](../../.claude/commands/commit.md).

Key rules:
- Conventional commit format: `<type>: <description>`
- Imperative mood, max 50 chars subject
- Body explains what and why

## Pull Requests

**Title:** `<JIRA-ID>: <Sentence ending with a period.>`
- Example: `SRVOCF-982: Clean up PoC-era workflow artifacts and sanitize slash commands.`

**Description:** Use the PR template (`.github/pull_request_template.md`).
- List changes with emoji prefixes
- Link the Jira ticket: `Relates to SRVOCF-<number>`
- Explain "why" if no linked issue

**Process:**
- Prefer many small PRs, merge often
- Make thorough reviews, propose architectural improvements

## Traceability

Every branch, PR, and commit should link back to a Jira ticket:
- Branch name includes the Jira ID
- PR description links the ticket
- Commit body references the ticket when relevant
```

Commit: `docs: add workflow guide`

---

## ~~Task 5: Update `docs/WORKFLOW.md`~~

**Superseded:** WORKFLOW.md was deleted entirely per PR review feedback. Workflow
logic lives in the three slash commands (begin, commit, create-pr) instead.

---

## Task 6: Branch name validation script

Create `hack/check-branch-name.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

branch=$(git rev-parse --abbrev-ref HEAD)

# Skip checks for main branches
case "$branch" in
  master|main|HEAD) exit 0 ;;
esac

# Pattern: JIRA-ID followed by short description
# e.g. SRVOCF-982-workflow-guide-cleanup
if ! echo "$branch" | grep -qE '^[A-Z]+-[0-9]+-[a-z0-9]+(-[a-z0-9]+)*$'; then
  echo ""
  echo "branch-name: FAILED"
  echo "  Branch name must match: <JIRA-ID>-<short-description>"
  echo "  Example: SRVOCF-982-workflow-guide-cleanup"
  echo "  Got: $branch"
  echo ""
  echo "See docs/workflow-guide.md for rules."
  exit 1
fi
```

Commit: `chore: add branch name validation script`

---

## Task 7: Add branch name lint to Husky pre-push hook

Create `.husky/pre-push`:

```bash
#!/usr/bin/env bash

./hack/check-branch-name.sh
```

Commit: `ci: add branch name lint to pre-push hook`

---

## Task 8: Add branch name and commit message lint to CI

Update `.github/workflows/ci.yml` to add a lint step in the `checks` job, after "Install Dependencies" and before "Lint":

```yaml
      - name: Check branch name
        if: github.event_name == 'pull_request'
        run: ./hack/check-branch-name.sh

      - name: Check commit messages
        if: github.event_name == 'pull_request'
        run: |
          commits=$(git log --format='%s' origin/${{ github.base_ref }}..HEAD)
          echo "$commits" | while IFS= read -r subject; do
            if ! echo "$subject" | grep -qE '^(feat|fix|refactor|docs|test|chore|style|perf|ci|build): .+'; then
              echo "Bad commit message: $subject"
              echo "Must match: <type>: <description>"
              exit 1
            fi
          done
```

Commit: `ci: add branch name and commit message lint`
