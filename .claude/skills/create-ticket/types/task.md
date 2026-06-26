# Task

Covers engineering work (refactor, reuse, tech debt, cleanup, test/build improvements) AND infrastructure changes (env var, secret, config, deployment setting). Infrastructure is NOT a separate type — it is a Task with the `infra-task` label and a different field set + body format. See `../labels.md`.

## Step 3.0 — Infra sub-classification

Before gathering fields, detect whether this Task is an infrastructure change.

**Infra signals** (auto-apply `infra-task` label when ANY are present):

- Keywords: environment variable, env var, secret, credential, config change, deployment, `LOG_LEVEL`, `NODE_ENV`, prod / uat / development, Kubernetes, Helm, CI/CD, pipeline
- The user invoked `/create-ticket infra: …` (args prefix forces infra-task label)
- The description only describes a runtime/config change with no code change

If infra signals are clearly present → auto-apply `infra-task` label (tell the user), use the **Infra Task** field set and body format below.
If genuinely ambiguous → use **AskUserQuestion**:

> "This looks like a Task. Is it an infrastructure change (env var, secret, config, deployment)?"
> Options: **Yes, infra** (adds `infra-task` label) / **No, general task**

Skip any field already covered by the approved Step 2 draft.

## General Task — fields (no `infra-task` label)

1. **Description**: Ask:
   > "Describe the task. What needs to change and why? (problem/motivation)"
2. **Acceptance criteria** (optional): Ask:
   > "List acceptance criteria or sub-tasks as checklist items (one per line), or skip."
   > Format each as `- [ ] <item>` in the body.
   > If the task touches hand-authored `libs/*`, include a checklist item to verify no host/external integration details were added to the lib. If it touches `libs/chat-api-client`, include a checklist item to verify generated files were regenerated from OpenAPI sources.
3. **Related issues** (optional): Ask:
   > "Are there any related issues or PRs? (paste numbers/URLs or skip)"

### General Task — body format

```markdown
### Description

<description>

### Acceptance criteria

<checklist items or "_No response_">

### Related issues

<issues or "_No response_">

### Details

<details-section>

### Confidential information

- [x] I confirm that do not share any confidential information
```

## Infra Task — fields (`infra-task` label auto-applied)

1. **Change type**: Use **AskUserQuestion** with options:
   - environment variable
   - secret
   - config change
   - extra configuration
   - other
2. **Target environment**: Use **AskUserQuestion** with options:
   - development
   - uat
   - production
   - all
3. **Task list**: Ask:
   > "List the changes needed as checklist items (one per line)."
   > Format each as `- [ ] <item>` in the body.
4. **Context / reason** (optional): Ask:
   > "Why is this change needed? Link to a ticket, incident, or PR if applicable. (or skip)"

### Infra Task — body format

```markdown
### Type of change

<change type>

### Target environment

<environment>

### Task list

<checklist items>

### Context / reason

<context or "_No response_">

### Details

<details-section>
```
