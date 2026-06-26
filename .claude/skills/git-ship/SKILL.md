---
name: git-ship
model: claude-haiku-4-5-20251001
context: fork
effort: low
allowed-tools: Bash(git:*), Bash(gh:*), Bash(grep:*), Read, Edit(.agents/skills/git-ship/areas.md)
arguments: ticket area
argument-hint: '[ticket] [area]'
description: >
  Use this skill whenever the user wants to commit, push, or ship changes in a git repository.
  Triggers include: "commit changes", "push my changes", "ship it", "commit and push", "create a branch and commit",
  "make a PR", "open a pull request", "create draft PR", or any variation of committing/pushing work.
  Always use this skill when the user mentions committing — even casually — as it handles the full cycle:
  branch → add → commit → push → (optionally) PR, with Conventional Commits format and automatic area detection.
---

# Git Ship Skill

Full cycle for **ai-dial-chat**: checkout new branch from `development-1.0` → stage → commit
(Conventional Commits) → push → optional PR. Base branch is **`development-1.0`**.

Supporting files (read them when the step says so — don't inline everything up front):

- `.agents/skills/git-ship/areas.md` — how to resolve the commit `area` (scope) for this repo.
- `.agents/skills/git-ship/examples/commit-messages.md` — type table, message + branch examples.
- `.agents/skills/git-ship/examples/pr-body.md` — PR body template, rules, and `gh pr create` usage.

---

## Step 0 — Detect mode (new branch vs. update existing)

```bash
git rev-parse --abbrev-ref HEAD                 # current branch
gh pr view --json number,url,state 2>/dev/null  # open PR for current branch (if any)
```

- **New-branch mode** — current branch is `development-1.0` (or another base branch), or there's no
  PR for it. Run the full cycle: Steps 1–6.
- **Update-existing mode** — you're already on a feature branch **and** it has an open PR (or the
  user says "push to the existing PR" / "update my PR"). **Do not** create a new branch and **do
  not** run `gh pr create`. Stay on the current branch, then:
  1. Step 2 — review the changes.
  2. Step 4 — generate the commit message (reuse the existing PR's ticket; keep the same area/type).
  3. Step 5 — **skip the `git checkout` lines**; just `git add` → `git commit` → `git push`.
  4. Skip Step 6's `gh pr create`. Pushing updates the open PR automatically. Only refresh the body
     (`gh pr edit --body`) if the user asks or the description is stale/missing.
  5. Step 7 — report the existing PR link, not a new one.

---

## Step 1 — Gather required context

- **Ticket number** — use the `ticket` argument if passed. Else look in conversation context. If
  still not found, ask: _"What is the ticket number?"_
- **Area** — if the `area` argument is passed, use it directly in Step 3.
- **Draft PR?** — if the user said "draft", note it for Step 6.

> This skill runs in a forked context (`context: fork`), so it does **not** see the main
> conversation. Prefer passing arguments: `/git-ship 7432 catalog`.

---

## Step 2 — Understand the changes

```bash
git status
git diff HEAD
```

If there are no changes at all — report and stop.

---

## Step 3 — Determine `area`

If the `area` argument was given, use it. Otherwise **read
`.agents/skills/git-ship/areas.md`** and map the changed files to an area using its resolution
rules. If the resolved area is new, follow that file's append-only self-extend rules so the
taxonomy grows (the edit is staged in Step 5 and ships in the same commit).

---

## Step 4 — Generate commit message

Format: `<type>(<area>): <short description> (Issue #<ticket>)`.

**Read `.agents/skills/git-ship/examples/commit-messages.md`** for the type table, message
examples, and the branch-name rule. Analyze the diff to pick the most accurate type and write a
concise, imperative description. Breaking change → add `!` before the colon.

---

## Step 5 — Execute

```bash
# 1. Create branch from base (skip in update-existing mode)
git checkout development-1.0
git checkout -b <type>/<short-slug>

# 2. Stage all changes (includes any areas.md self-extend edit)
git add .

# 3. Commit
git commit -m "<type>(<area>): <description> (Issue #<ticket>)"

# 4. Push
git push origin <type>/<short-slug>
```

If push fails (no permissions, rejected, conflict) — **report the full output and stop**. Do not
force push or rebase automatically.

---

## Step 6 — Pull Request (if requested)

If the user requested a PR or draft PR, **read `.agents/skills/git-ship/examples/pr-body.md`** and
follow the repo PR template (`.github/pull_request_template.md`) — fill every placeholder, then run
the `gh pr create` command shown there with `--base development-1.0`.

---

## Step 7 — Summary

Always finish with a concise confirmation:

```
Branch:  <type>/<short-slug>
Commit:  <type>(<area>): <description> (Issue #<ticket>)
Push:    ✅ succeeded  /  ❌ failed — <reason>
PR:      <link> (created)  /  <link> (updated existing)  /  skipped
Area:    <area>  (note "added to taxonomy" if Step 3 self-extended areas.md)
```
