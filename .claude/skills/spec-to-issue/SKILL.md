---
name: spec-to-issue
description: 'Generate a GitHub issue description in Markdown from openspec changes on the current branch. Use when asked to "create issue description", "write issue", "generate issue from spec", or "document this feature as a ticket". Reads openspec/changes/ files introduced on the branch and outputs a User Story + Acceptance Criteria + Definition of Done body ready for GitHub.'
argument-hint: 'Optional: path to a specific openspec change folder, e.g. openspec/changes/archive/2026-06-15-file-dnd-overlay'
---

# Spec-to-Issue

Generate a GitHub issue description from the openspec changes introduced on the current branch.

## When to Use

- User asks to write, create, or generate an issue / ticket description for the current branch
- User asks to "document this feature as a story"
- User wants to capture the branch's spec changes as a GitHub issue body

## Output Format

```markdown
#### User Story

**As a** <persona>
**I want to** <action / capability>
**So that** <benefit>

#### Acceptance Criteria

- <criterion 1>
- <criterion 2>
- ...
```

## Procedure

### Step 1 — Discover openspec changes on the branch

Run the following to find the base branch (default `main`):

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master
```

Then get the list of openspec files added or modified compared to that base:

```bash
git diff --name-only $(git merge-base HEAD main 2>/dev/null || git merge-base HEAD master) -- openspec/
```

If the user supplied a specific path argument, skip discovery and jump to Step 2 with that path.

If no openspec files are found on the branch, tell the user and stop.

### Step 2 — Read the spec content

For each changed openspec change folder found, read the following files **in priority order** (read all that exist):

1. `proposal.md` — primary source: Why, What Changes, Capabilities, Impact
2. `design.md` — supplementary detail
3. `tasks.md` — acceptance criteria hints (completed checkboxes = delivered scope)
4. `.openspec.yaml` — metadata (title, status)

If the diff includes files in `openspec/changes/wire-…/specs/` or `openspec/specs/`, read those spec files too.

Use `read_file` for each file. Read them in parallel where possible.

### Step 3 — Synthesise the issue description

Using the content gathered, produce the issue body.

#### User Story

- **As a**: identify the primary end-user persona from the spec. Default to "user" if not stated. Use "developer" only for tooling/infrastructure specs.
- **I want to**: one clear action sentence derived from the "What Changes" / capability description.
- **So that**: the business value from the "Why" section.

Keep each field to one sentence.

#### Acceptance Criteria

Derive from:

- Capabilities listed in `proposal.md` → "New Capabilities" and "Modified Capabilities"
- Completed tasks in `tasks.md` (checked `- [x]` items) grouped by area
- Impact items that describe observable user-facing changes

Write each criterion as a concise, testable, present-tense statement ("User can …", "The system …", "When …, then …"). Aim for 4–8 items.

### Step 4 — Output

Print the full Markdown issue body in a fenced code block so the user can copy it directly.

Then offer:

> "Want me to create this issue in GitHub with `gh issue create`?"

If the user says yes, use `gh issue create --title "<derived title>" --body "<body>" --label "feature"` (or "bug" / "task" based on the spec type).
