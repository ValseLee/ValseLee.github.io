# Herdr Worktree Dispatch Rules

<primary_directive>
In Herdr, keep `main` and the primary checkout as coordination surfaces. When a repository task starts from either one, create or open the requested Git worktree as a Herdr workspace and hand the task to a child Codex running there in YOLO mode.
</primary_directive>

<cognitive_anchors>
TRIGGERS: every repository task when HERDR_ENV=1
SIGNAL: Before repository work -> stay in a non-main linked worktree, otherwise dispatch through a Herdr-managed worktree
</cognitive_anchors>

## Preflight

1. Apply this workflow only when `HERDR_ENV=1`. Outside Herdr, continue in the current checkout unless the user requests another workflow.
2. Before planning or changing the repository, inspect the current branch, `git status --short`, and the paths from `git rev-parse --path-format=absolute --git-dir` and `git rev-parse --path-format=absolute --git-common-dir`.
3. Treat the checkout as a linked worktree only when the absolute Git directory and common directory differ.
4. If the current branch is not `main` and the checkout is linked, work in the current session. Do not create a nested worktree or child session.
5. If the current branch is `main` or the checkout is not linked, dispatch before doing repository work. An explicit user instruction to remain in or use a particular checkout overrides this default.
6. Preserve existing changes. If dirty files overlap the requested work, stop and ask how to carry that state forward. If they are unrelated, leave them untouched and create the worktree from the current `HEAD`; never stash, commit, copy, or discard them merely to dispatch.

## Dispatch

1. Load and follow the `herdr` skill. Use `herdr worktree create` for a new task branch or `herdr worktree open` when the user named an existing worktree. Do not substitute `git worktree add`, because it does not register the checkout as a Herdr workspace.
2. Give the branch and workspace a short task-specific name. Read the workspace and pane IDs from Herdr's JSON responses; never derive IDs from display order.
3. Confirm that the returned workspace points at the intended worktree and branch. Start `codex --dangerously-bypass-approvals-and-sandbox` in its agent pane, wait for the agent to become idle, then send the user's original instruction.
4. Include the repository guidance bootstrap in the handoff. Tell the child to stay in that worktree, avoid another worktree or child Codex, preserve unrelated changes, verify its work, and report the guidance it loaded.
5. Wait until the child is working, then report the actual workspace, worktree, branch, and pane IDs. The parent session coordinates, monitors, and returns the result; it does not duplicate the repository work in the original checkout.
6. If creation, launch, or handoff fails, inspect the Herdr pane and workspace state and report the blocker. Do not silently fall back to editing `main` or the primary checkout.

## Completion

- Read the child result and final worktree state before reporting completion.
- Require the child to apply `.codex/guidance/verify.md` and surface any skipped or failed checks.
- Leave the Herdr workspace and worktree available for user inspection unless the user explicitly asks to remove them.
