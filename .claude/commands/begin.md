---
allowed-tools: Bash(git log:*), Bash(git branch:*), Bash(pwd), Bash(./init.sh), Bash(yarn ci*), Bash(cat .dev-env.json), Read
description: Start a session, orient, and pick work
argument-hint: "[JIRA-TICKET-OR-URL]"
---

# Begin Session

## Steps

1. **Confirm working directory**: run `pwd`.
2. **Orient**: understand the project and recent activity:
   - Read `docs/ARCHITECTURE.md`
   - Read `docs/STYLEGUIDE.md`
   - Review recent commits (full messages and changed files):

     ```bash
     git log --stat -20
     ```

3. **CI check**: run `yarn ci` (lint, test, build) and verify the project is healthy.
4. **Branch**: generate the branch name:

   ```bash
   ./hack/branch-name.sh $1
   ```

5. **Propose planning**: step 1 of the Feature Development Sequence in `docs/WORKFLOW.md`. Do NOT start any work autonomously.
