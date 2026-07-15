# Workflow — func-console

## Startup Sequence

Handled by the `begin` command (`.claude/commands/begin.md`).

## Feature Development Sequence

After [Startup Sequence](#startup-sequence), work through the picked feature:

1. **Plan**: read `docs/TESTING.md`, then design the feature and create implementation plan in `docs/plans/active/`
2. **Implement**: using `/executing-plans` skill
3. **Review**: code review using `/requesting-code-review` skill, fix found issues
4. **Manual Test**: use browser automation and validate it works in the browser
5. **Complete**: move plan to `docs/plans/completed/`, commit
6. **PR**: push branch, open PR per [Pull Requests](#pull-requests) convention
7. Stop: wait for PR review. Rework per [Received PR Reviews](#received-pr-reviews) when asked.

## Received PR Reviews

For each comment: read the full text and its diff hunk context, make the fix, then re-read the comment and verify your change actually matches what was asked (placement, naming, scope, not just compilation). Reply in the thread stating what changed.

## Branching

Format: `<JIRA-ID>-<short-description>`. Example: `SRVOCF-982-workflow-guide-cleanup`. If we're on a feature branch already do nothing.

## Pull Requests

Open PRs via `gh pr create` using the template at `.github/pull_request_template.md`.

**Title format:** `<JIRA-ID>: <Sentence ending with a period.>` Example: `SRVOCF-982: Clean up PoC-era workflow artifacts and sanitize slash commands.`

## Commits

Follow [`.claude/commands/commit.md`](../.claude/commands/commit.md).

## Session Rules

- One feature at a time
