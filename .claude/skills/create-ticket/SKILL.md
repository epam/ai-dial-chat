---
name: create-ticket
model: haiku
description: Interactively create OR update GitHub issues (Bug, Feature, Task) for the current repository. Create from a discussion, from an openspec change (current branch or a specific change path), or update an existing issue with new details. Use for "create ticket/issue", "generate issue from spec", "document this feature as a ticket", or "update ticket/issue". Infrastructure changes are Tasks auto-labeled `infra-task`. Asks targeted questions, assigns labels, and runs the gh CLI.
alwaysApply: false
metadata:
  author: project
  version: '1.0'
---

Create a GitHub issue in this repository. Guides the user through an interactive flow to gather all required information, then creates the issue via `gh issue create`.

## Prerequisites

Before starting the flow, verify `gh` CLI is available and authenticated:

```bash
gh auth status
```

- If `gh` is not installed → stop and tell the user: "GitHub CLI (`gh`) is required. Install it: https://cli.github.com/"
- If not authenticated → stop and tell the user: "Run `gh auth login` to authenticate first."
- If authenticated → proceed to Step 0

**Usage**: `/create-ticket [type: description | from spec | <change-path> | update <#issue|url>]`

Examples:

- `/create-ticket` — fully interactive
- `/create-ticket bug: login page crashes on Safari`
- `/create-ticket feature: add bulk delete for models`
- `/create-ticket task: refactor Sidebar for reuse in entity lists`
- `/create-ticket infra: add LOG_LEVEL to prod`
- `/create-ticket from spec` — from the openspec changes on the current branch
- `/create-ticket openspec/changes/archive/2026-06-15-file-dnd-overlay` — from a specific change
- `/create-ticket update #123` — add details to an existing issue

---

## Step 0 — Intent, Source & Args

First decide which of three modes applies, then parse the remaining args.

- **Mode C — Update existing** — the user references an existing issue: `update`, `#<number>`, or a GitHub issue URL. → go to **Update Existing Ticket** below.
- **Mode B — From spec** — the user says "from spec", "from the branch", "issue from current change", or passes an `openspec/changes/...` folder path. → go to **From Spec** below, which drafts the Step 2 proposal, then continues at Step 1/3.
- **Mode A — From discussion** (default) — anything else. Continue with arg parsing here.

### Mode A arg parsing

If the user provided arguments after `/create-ticket`, parse them:

- Look for a type prefix: `bug:`, `feature:`, `task:`, `infra:` (case-insensitive)
  - `bug:` → Bug
  - `feature:` → Feature
  - `task:` → Task (general engineering)
  - `infra:` → Task + force `infra-task` label (shortcut for infra change)
  - If found → set issue type, use the rest as a seed for the title/description
  - If not found → treat the entire arg string as a description seed and ask for type
- If no args at all → start fully interactive from Step 1

When args provide a description seed (or the description comes from the current discussion), use it to:

- **Generate a proposed title** — concise, under 80 characters
- **Generate a proposed summary** — a short paragraph followed by key points as a bullet list. For bugs, also draft the actual/expected result from context.
- Pre-fill relevant body fields where obvious
- Auto-assign labels ONLY when the description makes them 100% clear
- For ANY label where assignment is not certain from the description, ask the user directly

---

## From Spec (Mode B)

Build the ticket from the openspec change(s) rather than free description. This produces a **User Story + Acceptance Criteria + Definition of Done** body, then flows through the normal pipeline (type, labels, priority, assignee, preview, create) so the ticket still gets `--project` and an assignee.

### B1 — Locate the change

- If the user passed a specific `openspec/changes/...` folder path → use it, skip discovery.
- Otherwise discover changes introduced on the current branch against the repo's base branch (`origin/development-1.0` — NOT `main`):

  ```bash
  git diff --name-only $(git merge-base HEAD origin/development-1.0) -- openspec/
  ```

- If no openspec files are found on the branch → tell the user and offer to fall back to Mode A (from discussion). Do not stop silently.

### B2 — Read the spec content

For each changed change folder, read (in priority order, all that exist, in parallel):

1. `proposal.md` — primary: Why, What Changes, Capabilities, Impact
2. `design.md` — supplementary detail
3. `tasks.md` — acceptance-criteria hints (checked `- [x]` = delivered scope)
4. `.openspec.yaml` — metadata (title, status)

Also read any `specs/*` files in the diff (`openspec/changes/<name>/specs/` or `openspec/specs/`).

### B3 — Synthesise the draft (feeds Step 2)

- **Title** — from `.openspec.yaml` title or the proposal heading, under 80 chars.
- **Type** — derive from the change (default Feature; use Bug/Task if the spec is clearly a fix or engineering task). Confirm in Step 1.
- **Summary body** — structured as:

  ```markdown
  #### User Story

  **As a** <persona — end user; "developer" only for tooling/infra>
  **I want to** <one action derived from "What Changes" / capability>
  **So that** <business value from "Why">

  #### Acceptance Criteria

  - <concise, testable, present-tense: "User can …", "When …, then …"> (aim for 4–8)

  #### Definition of Done

  - <delivered scope from checked tasks.md items + repo defaults: tests, i18n, RTL, docs where relevant>
  ```

Use this as the Step 2 draft, then continue at **Step 1** (confirm type) → **Step 3** onward. Skip Step 2a code research (the spec already is the research) unless the user asks.

---

## Update Existing Ticket (Mode C)

Add details to an issue that already exists. Default action is to **edit the body in place**; appending a comment is offered as an option.

### C1 — Resolve the target issue

- If args include `#<number>` or an issue URL → use it.
- Otherwise list candidates and let the user pick:

  ```bash
  gh issue list --search "<keywords from the request>" --limit 10 --json number,title,url
  ```

### C2 — Fetch current state

```bash
gh issue view <number> --json number,title,body,labels,assignees,url,state
```

Show the user the current title, labels, assignee, and body.

### C3 — Gather the new details

Collect what to add from the discussion, or reuse **From Spec (Mode B)** if the update should come from an openspec change. Determine which of these change: body content, labels, title, assignee, priority.

### C4 — Preview the before → after

Show the current vs. proposed body/labels/title so the user sees exactly what changes. Use **AskUserQuestion**:

> "Apply this update?"

Options:

- **Edit body** (default) — merge the new details into the issue body and update labels/title as needed
- **Add comment** — keep the body, append the new details as a comment
- **Cancel** — make no change

### C5 — Apply

- Edit body / fields:

  ```bash
  gh issue edit <number> \
    --body "<merged body>" \
    --add-label "<label>" \
    --title "<new title if changed>"
  ```

- Or add a comment:

  ```bash
  gh issue comment <number> --body "<new details>"
  ```

Use `--add-label` / `--remove-label` for label changes; only pass `--title`/`--body` when they change. After applying, display the issue URL. Then stop — the rest of the create pipeline (Steps 1–8) does not apply to updates.

---

## Step 1 — Issue Type

Skip if the type was parsed from args. If it was **derived from a spec (Mode B)**, don't skip — confirm the derived type with the user (pre-select it as the default) before continuing.

Use **AskUserQuestion** to ask:

> "What type of issue do you want to create?"

Options (these match the repo's GitHub issue types):

- **Bug** — Report a problem or defect
- **Feature** — Request a new feature or enhancement
- **Task** — Engineering work that is not a user-facing feature (refactor, reuse, tech debt, cleanup, test/build improvements, AND infrastructure changes — env var, secret, config, deployment setting)

Infrastructure changes are NOT a separate top-level type. They're a Task that gets auto-labeled `infra-task`. Detection happens in Step 3 from context keywords (env var, secret, prod/uat, deployment, config, LOG_LEVEL, etc.).

---

## Step 2 — Title & Summary Proposal

### 2a. Optional Code Research

Before drafting the proposal, check whether the user's input references code concepts that would benefit from codebase investigation.

**Trigger signals** (offer the question when ANY are present):

- Verbs: refactor, reuse, extract, consolidate, migrate, rename, split, merge, deduplicate, unify, abstract, move, replace
- Implementation nouns paired with an action: component, hook, utility, service, module, layout, route, page, store, context, provider
- Explicit file paths, component names (e.g., `Sidebar`), or function/hook names

If triggered, use **AskUserQuestion**:

> "Your request touches code (e.g., refactoring/reuse). Do you want me to dive into the codebase and include relevant details in the ticket?"

Options:

- **Yes, research** — Explore the codebase and add findings to the description
- **No, skip** — Proceed without code research

If **Yes**, spawn an **Explore** agent (via the Agent tool with `subagent_type: Explore`) to find:

- Current location(s) of the subject code (file paths with line references)
- Similar or duplicated patterns elsewhere in the codebase
- Files/components/consumers that would be affected by the change
- Existing conventions or abstractions to align with
- If hand-authored `libs/*` are involved, the app/lib boundary: host-owned integration details
  such as API paths, generated clients, server-api wrappers, auth/session/cookie/env details,
  feature flags, routes/navigation, analytics/telemetry/logging, SDK setup, platform bridges, and
  app-specific storage keys/schemas must stay outside libs
- If `libs/chat-api-client` is involved, call out that it is generated by OpenAPI scripts and
  should not be hand-edited

Keep the summary concise — bullet points with `path:line` references, not prose walls. These findings feed into **2b** (title sharpness, description clarity, and a new **Details** section in the body).

### 2b. Draft the Proposal

Based on the user's input, answers so far, and any code research findings:

1. **Propose a title** — concise, under 80 characters. If research was done, make it specific (e.g., "Refactor `Sidebar` for reuse in `ModelList`, `AdapterList`, `UserList`").
2. **Propose a summary** — structured as:
   - A short description paragraph (1-3 sentences explaining _what_ and _why_)
   - **Key points** as a bullet list extracting the important details
   - If the task touches hand-authored `libs/*`, include a key point that the lib remains host-agnostic
     and host/external behavior is passed in via props, callbacks, resolved values, or narrow interfaces
   - If the task touches `libs/chat-api-client`, include a key point that it is regenerated from
     OpenAPI sources rather than manually edited
   - For **bugs**: also include drafted "Actual result" and "Expected result" if enough context exists
   - If code research was done: a **Details** section listing current location, affected files, duplicated patterns, and recommended scope (with `path:line` references)

3. **List all labels** that will be auto-assigned based on the issue type and any labels already determined from context (e.g., `bug`, `Design Required` if obvious from description). Mark labels that will be asked about later as "TBD".

Present the proposal to the user and ask for confirmation:

> "Here's what I've drafted from your input:
>
> **Title**: `<proposed title>`
>
> **Summary**:
> <description paragraph>
>
> Key points:
>
> - <point 1>
> - <point 2>
> - ...
>
> **Labels (planned)**:
>
> - `label1` (auto)
> - `label2` (auto)
> - Priority — TBD
> - Severity — TBD
> - ...
>
> Want to use this, or change anything?"

Options:

- **Use as-is** — proceed with this draft
- **Edit** — I want to change something

If **Edit**: ask what they want to change, revise, and re-confirm.

The proposed summary becomes the main content of the description/body field.

**IMPORTANT**: If the user approves the draft ("Use as-is"), do NOT re-ask fields that were already covered in the draft. In Step 3, only ask for fields that are missing or were not part of the proposal. For example, if the draft already includes "Actual result" and "Expected result" for a bug, skip those questions and only ask for remaining fields (version confirmation, steps to reproduce, severity, etc.).

---

## Step 3 — Type-Specific Fields

Before asking individual fields, if the draft from Step 2 already covers some fields, ask the user:

> "The draft already covers some details. How do you want to proceed?"

Options:

- **Use draft, fill remaining** — Accept drafted fields, only ask for missing ones (version, severity, etc.)
- **Provide details now** — Go through each field interactively
- **Use draft as-is** — Skip all type-specific questions, use drafted content for all fields and fill missing fields with reasonable defaults or "_No response_"

Gather information interactively based on the issue type. **Read the file for the chosen type now** and follow its "Fields to gather" section — ask each field as a separate question using **AskUserQuestion** (open-ended, no preset options) unless a dropdown/choice is specified. Keep this file open: its "Body format" section is what you emit in Step 8.

- Bug → `types/bug.md`
- Feature → `types/feature.md`
- Task (and infra variant) → `types/task.md`

---

## Step 4 — Priority

Use **AskUserQuestion**:

> "What priority level?"

Options:

- **High** — Requires immediate action
- **Medium** — Important but not urgent
- **Low** — Low urgency

---

## Step 5 — Conditional Labels

Evaluate the description and context gathered so far. For each label below:

- If it is **100% clear** from context that the label applies → auto-assign it and inform the user
- If it is **uncertain** → ask the user directly

### Design Required

Auto-assign **yes** if the user explicitly mentions: new page, new UI component, layout change, redesign, UX change, new visual element.

Auto-assign **no** (skip the question entirely) when the context clearly has no design implications — e.g., crashes, errors, backend issues, config changes, refactoring, performance bugs, infra tasks.

Only ask the user when it's genuinely ambiguous (e.g., "improve the user list" — could be UX or just data):

> "Does this issue require design work?"
> Options: Yes / No

### SIA (Security Impact Analysis)

Auto-assign `SIA-required` if the user mentions: authentication, authorization, tokens, secrets, passwords, permissions, session, credentials, encryption, PII.

Otherwise ask:

> "Does this issue have a security impact that needs analysis?"
> Options:

- **SIA-required** — Yes, needs security review
- **SIA-not required** — No security impact

---

## Step 6 — Assignee

A ticket MUST have an assignee — never leave one unassigned (tickets without owners get lost). Default to the creator (`@me`).

Use **AskUserQuestion**:

> "Assign to you (the creator) by default, or someone else?"

Options:

- **Me (default)** — Assign to the creator (`@me`)
- **Someone else** — Ask for a GitHub username

If **Someone else**, ask:

> "GitHub username to assign?"

---

## Step 7 — Preview

Show the user a formatted preview of the entire issue:

```
══════════════════════════════════════════
ISSUE PREVIEW
══════════════════════════════════════════

Title:    <title>
Type:     <Bug/Feature/Task> (reflected via labels)
Labels:   <comma-separated list — includes `infra-task` if this is an infra change>
Assignee: <@me (creator) / username>
Project:  epam/68

──────────────────────────────────────────
BODY:
──────────────────────────────────────────

<formatted body matching template structure>

══════════════════════════════════════════
```

Use **AskUserQuestion**:

> "Create this issue?"

Options:

- **Create** — Create the issue now
- **Edit** — I want to change something
- **Cancel** — Don't create the issue

If **Edit**: Ask what they want to change, update it, and show the preview again.
If **Cancel**: Stop and confirm cancellation.

---

## Step 8 — Create

Build and execute the `gh` command:

```bash
gh issue create \
  --title "<title>" \
  --body "<body>" \
  --label "<label1>,<label2>,..." \
  --project "epam/68" \
  --assignee "<@me|username>"
```

Notes:

- `--type` is not supported by `gh issue create`. Issue type (Bug/Feature/Task) is conveyed via labels (`bug`, `enhancement`, or task-specific labels) — there is no separate type flag.
- There is no separate "Infra Task" type — infrastructure work is a Task with the `infra-task` label auto-applied and the infra-specific body structure (change type, target environment, task list).
- `--assignee` is ALWAYS set (default `@me`). Never omit it — the skill guarantees every ticket has an owner.
- The `<details-section>` placeholder in the body format is the code-research findings from Step 2a. If research was NOT performed, omit the entire `### Details` heading and its content — do not leave an empty section.
- The body must match the GitHub issue template output format. Use the **"Body format"** section from the type file you read in Step 3 (`types/bug.md`, `types/feature.md`, or `types/task.md` — the general or infra variant as applicable).

After successful creation, display the issue URL returned by `gh`.

---

## Label Reference

The full label table lives in `labels.md`. Read it when assigning labels in Steps 2b, 5, and 8.

## Guardrails

- NEVER create an issue without showing a preview and getting explicit confirmation
- NEVER auto-assign a label unless you are 100% certain from the user's input
- When uncertain about ANY label, ask directly — don't guess
- Always use the exact label names as listed in `labels.md`
- Always add `--project "epam/68"`
- The confidential information checkbox is always pre-checked in the body
- If `gh` CLI fails, show the error and suggest the user check their auth (`gh auth status`)
- For tickets touching hand-authored `libs/*`, include library isolation in the description or
  acceptance criteria: host/external interfaces stay in apps, libs receive props/callbacks/resolved values
- For tickets touching `libs/chat-api-client`, include that generated files are updated via
  OpenAPI generation scripts, not manual edits
