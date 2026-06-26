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

Claude-facing shortcut for the shared git-ship skill. Full cycle: checkout new branch from
`development-1.0` → stage → commit (Conventional Commits) → push → optional PR.

@.agents/skills/git-ship/SKILL.md
