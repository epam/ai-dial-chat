# Adding an Agent to the DIAL SDLC Pipeline

The runtime is **manifest-driven** and **skill-only**: an agent is a
manifest that points to a local Claude skill. The platform handles the
rest — GHA wiring, permissions, prompt composition, output validation,
sticky comments, and artifacts.

This page is the **quickstart**. For exhaustive field-by-field detail,
chaining rules, output contract, and skill-authoring guidance, see
[`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md). For platform-maintainer
concerns (framework relationship, doc-update triggers, supported
permissions), see [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md).

---

## Where things live

```
agents/<name>/agent.yml         your manifest
.claude/skills/<skill>/SKILL.md the skill it wraps
```

That's the entire surface you touch. Everything else under `.github/` is
platform code — don't edit per-agent.

---

## The recipe — one step

1. **Make sure the skill exists.** If you're wrapping a published Claude
   skill, install it under `.claude/skills/<skill>/SKILL.md`. If your task
   needs custom orchestration (CLI calls, multi-step logic), put it
   *inside* the skill — never in the agent. See
   [`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md) → *Writing a skill for an
   agent* for skill structure and the "I have a prompt not a skill"
   conversion path.

2. **Copy the template manifest and edit four fields:**

   ```bash
   cp -r agents/_template agents/my-agent
   ```

   In `agents/my-agent/agent.yml`:

   - `name:` → `my-agent` (kebab-case)
   - `skill:` → the local skill the agent wraps (e.g. `my-skill`,
     `opsx:verify`, `code-review-and-quality`)
   - `allowed_tools:` → the smallest set the skill needs, plus `Skill`
   - Optional: `agent_version`, `description`, `model`, `phase`,
     `cost_class`

Commit. The next PR runs the agent automatically — no workflow YAML to
edit, no dispatcher changes, no prompt to write.

---

## Minimal manifest

```yaml
contract_version: "0.1"
name: my-agent
skill: my-skill
triggers: [pull_request]
allowed_tools: "Read,Grep,Glob,Skill"
```

Five fields. That's the entire required surface.

---

## PR agents vs batch/scheduled agents

The minimal manifest above is a **PR agent** — it runs on `pull_request` and
posts a sticky comment. Agents can also run on a schedule or manual dispatch
(triage a standing backlog, nightly audits) by declaring
`triggers: [pull_request, schedule, workflow_dispatch]`, and can keep their
output private (encrypted artifact + counts-only job summary) with
`private_output: true`. See
[`../../docs/sdlc/scheduled-batch-agents.md`](../../docs/sdlc/scheduled-batch-agents.md)
for the as-built batch pattern and
[`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md) for `secrets`, `analysis_ref`,
`private_output`, and `emit_sarif`.

---

## Disabling a live agent

Set the kill-switch variable `STAGE_<NAME_UPPER>_ENABLED=false` in
**Settings → Variables → Actions** — e.g., `STAGE_MY_AGENT_ENABLED=false`.
The matcher omits the agent at discovery; no runner time spent. Delete
the variable to re-enable. Details and conventions in
[`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md) → *Kill switch*.

---

## When to read what

| You want to… | Open |
|---|---|
| Add an agent right now | This doc (you're here) |
| Look up a manifest field, tool tier, or output convention | [`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md) |
| Make your agent depend on another agent's output | [`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md) → *Chaining* |
| Write a skill from scratch or adopt an external one | [`AGENT_REFERENCE.md`](./AGENT_REFERENCE.md) → *Writing a skill for an agent* |
| Understand framework relationship, supported permissions, cross-run state | [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md) |
| Change platform code (new trigger, new permission tier, output schema, etc.) | [`PLATFORM_REFERENCE.md`](./PLATFORM_REFERENCE.md) → *What requires a doc update* |
