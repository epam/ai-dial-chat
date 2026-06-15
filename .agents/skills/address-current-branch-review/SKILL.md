---
name: address-current-branch-review
description: Read unresolved GitHub code review threads for the pull request associated with the current branch, classify each comment, implement and verify required code fixes, and post an accurate inline reply. Use when the user asks to handle, address, process, fix, or answer code review comments on the current branch or current PR. For comments that need no code change, reply with a concise technical explanation instead of modifying code.
---

# Address Current Branch Review

Process current-branch review feedback end to end: inspect thread state, decide whether code must change, verify any fix, and reply in the original review thread.

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
   - Also fetch flat PR comments when numeric comment IDs are needed for inline replies.
   - Ignore resolved, outdated, approval-only, informational, bot-only, and duplicate threads.
   - Do not assume flat comments represent thread resolution state.

4. Prevent duplicate work.
   - Read every reply already present in the thread.
   - Skip a thread if the requested change is already present in the current code and an adequate answer was already posted.
   - If code is fixed but unanswered, post only the missing reply.

5. Classify each active thread.

   | Classification | Action |
   | --- | --- |
   | `fix-required` | Change code, add or update tests, verify, then reply |
   | `reply-only` | Do not change code; reply with the technical reason or clarification |
   | `ambiguous` | Do not guess or post; ask the user for the missing decision |
   | `conflicting` | Explain the conflict and ask before changing behavior |

6. Implement `fix-required` threads.
   - Inspect the full affected file and related tests, not only the diff hunk.
   - Follow `.claude/skills/incremental-implementation/SKILL.md` for multi-file work.
   - Keep every change traceable to a specific review thread.
   - Preserve unrelated user changes and staged files.
   - Do not commit, push, or force-update branches unless explicitly requested.

7. Verify each fix before replying.
   - Use Nx through the workspace package manager.
   - Choose the smallest relevant tests first, then run project lint and build when appropriate.
   - Never claim a fix passed if the required command failed or was not run.
   - If verification fails, continue fixing; do not post a success reply.

8. Draft the reply.
   - Match the reviewer's language when practical.
   - Keep it concise and technical.
   - For a verified fix, state what changed and the relevant check.
   - For `reply-only`, explain why no code change is needed and reference the existing behavior or contract.
   - Do not be defensive, over-apologetic, or vague.

9. Check whether the fix is visible in the PR.
   - Compare local status and local `HEAD` with the PR head SHA.
   - If the change is already visible in the PR, state that it is fixed.
   - If the change exists only in the working tree or an unpushed commit, say so explicitly, for example:
     `Prepared the fix locally: ... It will appear in the PR after push. Verification: ...`
   - Never imply that unpushed code is visible to the reviewer.

10. Post the inline reply.
    - Invocation of this skill authorizes replies for clearly classified processed threads.
    - Prefer the GitHub app inline reply action using the thread's top-level numeric review comment ID.
    - Map GraphQL thread comments to numeric IDs through the flat PR comment list when necessary.
    - Use `gh api graphql` only as a fallback.
    - Post at most one new reply per processed thread.
    - Do not resolve threads, submit a review, approve, request changes, commit, or push unless explicitly requested.

11. Summarize.
    - List fixed-and-replied threads.
    - List reply-only threads.
    - List skipped or ambiguous threads.
    - Report verification commands and any remaining warnings.

## Reply Patterns

Verified and visible:

```text
Fixed: moved error handling to the global NotificationContext. Verified with `npm exec nx test chat` and `npm exec nx lint chat`.
```

Verified but not pushed:

```text
Prepared the fix locally: replaced the arbitrary value with a Tailwind token. It will appear in the PR after push. Verified with `npm exec nx test chat`.
```

No code change needed:

```text
No code change is needed here: the value is provided through an app-level adapter, so the library remains unaware of the REST path and preserves isolation.
```

## Safety Rules

- Never reply before understanding the full thread and current code.
- Never post a success reply for an unverified fix.
- Never fabricate test results, commit SHAs, or PR visibility.
- Never silently resolve a conversation.
- Never answer an ambiguous behavioral request on the reviewer's behalf.
- Never overwrite, unstage, or revert unrelated changes.
