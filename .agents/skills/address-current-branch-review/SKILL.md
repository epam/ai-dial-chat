---
name: address-current-branch-review
description: Read unresolved GitHub code review threads for the pull request associated with the current branch, classify each comment, and implement and verify required code fixes. Post inline replies only when the user explicitly asks to reply after the changes have been pushed and are visible in the PR.
---

# Address Current Branch Review

Process current-branch review feedback: inspect thread state, decide whether code must change, and verify any fix. Treat posting review replies as a separate, explicitly authorized action after push.

## Reply Authorization Gate

- A request to fix, handle, address, or process review comments authorizes code changes only. It does not authorize posting GitHub comments.
- Post replies only when the user separately and explicitly asks to reply or answer the review comments.
- Before posting a fix reply, verify that the relevant commit is pushed and included in the PR head. Local working-tree changes or unpushed commits are never sufficient.
- If the fix is not visible in the PR, do not post. Tell the user to push first.
- Replies must describe the current PR state as already updated or fixed. Never post wording such as “prepared locally,” “will appear after push,” or any other future-tense visibility disclaimer.

## Workflow

1. Read repository instructions before editing.
   - Read root `AGENTS.md` and `openspec/config.yaml`.
   - Invoke `nx-workspace` before exploring project ownership or targets.
   - Apply any area-specific skill required by the touched files.

2. Resolve the current pull request.
   - Read the current branch and `origin` repository from local git.
   - Prefer the GitHub app to find the open PR whose head matches the branch.
   - Use `gh pr view` only when the GitHub app cannot resolve it.
   - Stop if there is no unique open PR for the branch.

3. Load thread-aware review data.
   - Use the GitHub app review-thread action to get `is_resolved`, `is_outdated`, path, line, and replies.
   - Fetch flat PR comments for numeric comment IDs only when the user explicitly asked to post replies.
   - Ignore resolved, outdated, approval-only, informational, bot-only, and duplicate threads.
   - Do not assume flat comments represent thread resolution state.

4. Prevent duplicate work.
   - Read every reply already present in the thread.
   - Skip a thread if the requested change is already present in the current code and an adequate answer was already posted.
   - If code is fixed but unanswered, report that status. Post the missing reply only after explicit reply authorization and the push check.

5. Classify each active thread.

   | Classification | Action                                                                        |
   | -------------- | ----------------------------------------------------------------------------- |
   | `fix-required` | Change code, add or update tests, and verify. Do not reply unless authorized. |
   | `reply-only`   | Draft a technical explanation. Post it only when explicitly authorized.       |
   | `ambiguous`    | Do not guess or post; ask the user for the missing decision.                  |
   | `conflicting`  | Explain the conflict and ask before changing behavior.                        |

6. Implement `fix-required` threads.
   - Inspect the full affected file and related tests, not only the diff hunk.
   - Follow `.claude/skills/incremental-implementation/SKILL.md` for multi-file work.
   - Keep every change traceable to a specific review thread.
   - Preserve unrelated user changes and staged files.
   - Do not commit, push, or force-update branches unless explicitly requested.

7. Verify each fix.
   - Use Nx through the workspace package manager.
   - Choose the smallest relevant tests first, then run project lint and build when appropriate.
   - Never claim a fix passed if the required command failed or was not run.
   - If verification fails, continue fixing and do not post a success reply.

8. Draft a reply without posting it.
   - Match the reviewer's language when practical.
   - Keep it concise and technical.
   - For a verified fix, state what changed and the relevant check.
   - For `reply-only`, explain why no code change is needed and reference the existing behavior or contract.
   - Do not be defensive, over-apologetic, or vague.
   - Do not use local-only or future-tense wording.

9. Stop after implementation unless replies were explicitly requested.
   - Summarize local changes and verification to the user.
   - Do not call any GitHub reply/comment mutation.

10. If and only if replies were explicitly requested, check PR visibility and post.
    - Fetch the current PR head SHA immediately before posting.
    - Verify that the pushed PR head contains the relevant fix commit and that the fix appears in the PR diff.
    - If the local fix is uncommitted, unpushed, or absent from the PR diff, stop without posting.
    - Prefer the GitHub app inline reply action using the thread's top-level numeric review comment ID.
    - Map GraphQL thread comments to numeric IDs through the flat PR comment list when necessary.
    - Use `gh api graphql` only as a fallback.
    - Post at most one new reply per processed thread.
    - Do not resolve threads, submit a review, approve, request changes, commit, or push unless explicitly requested.

11. Summarize.
    - List fixed threads and whether each fix is visible in the PR.
    - List replies posted only when posting was explicitly requested.
    - List reply-only threads.
    - List skipped or ambiguous threads.
    - Report verification commands and any remaining warnings.

## Reply Patterns

Verified and visible:

```text
Updated: moved error handling to the global NotificationContext. Verified with `npm exec nx test chat` and `npm exec nx lint chat`.
```

No code change needed:

```text
No code change is needed here: the value is provided through an app-level adapter, so the library remains unaware of the REST path and preserves isolation.
```

## Safety Rules

- Never treat a request to fix review feedback as permission to post a GitHub reply.
- Never post a fix reply until the user explicitly asks for it after pushing.
- Never post a fix reply when the change is only local or unpushed.
- Never use “prepared locally,” “will appear after push,” or equivalent wording in a review reply.
- Never reply before understanding the full thread and current code.
- Never post a success reply for an unverified fix.
- Never fabricate test results, commit SHAs, or PR visibility.
- Never silently resolve a conversation.
- Never answer an ambiguous behavioral request on the reviewer's behalf.
- Never overwrite, unstage, or revert unrelated changes.
