# Skills

Reusable behavioral guidelines imported by agent CLAUDE.md files via `@../../skills/<name>.md`.

Skills are **shared prompt fragments**, not code. They tell every agent that imports them how to handle a cross-cutting concern (Slack posting, status reporting, traceability matrix updates, etc.) consistently.

## What lives here

| Skill | Purpose |
|---|---|
| `tool-conventions.md` | Which native tool to use for which task (Read > cat, Write > echo, etc.). Imported by every agent. |
| `notify-slack.md` | Channel routing + standard message formats. Imported by every agent. |
| `report-status.md` | How agents write `.state/status/<agent>.json` summaries. |
| `traceability-lookup.md` | Read/write conventions for `.state/traceability/matrix.json`. |
| `qa-soul.md` | Behavioral non-negotiables for any agent that writes, runs, maintains, or reports on tests. Imported by every LLM agent in the test pipeline. |

## Rules for editing

These rules exist because skills sit on the hot path: every import goes into the agent's system prompt, every token counts, and every overlap dilutes attention.

### 1. Size discipline

| File | Sweet spot | Warning | Bad |
|---|---|---|---|
| Skill (`skills/*.md`, excluding this README) | **30–80 lines** | 80–150 | 150+ |
| Agent CLAUDE.md | **50–120 lines** | 120–180 | 180+ |
| Combined system prompt (CLAUDE.md + all imports) | **<400 lines** | 400–700 | 700+ |

This README is exempt — it's reference doc for humans, not a prompt fragment imported by agents.

Under 30 lines per skill usually means the skill is under-specified and the agent will invent rules. Over 80 usually means redundancy or two jobs jammed into one file.

### 2. One job per file

`notify-slack` does Slack. `traceability-lookup` does the matrix. Do not merge "related" skills — separate files let agents import only what they need, and let humans diff a single concern in isolation.

### 3. Examples beat prose

A 3-line concrete example replaces 8 lines of principle:

```markdown
# Good (concrete)
Use `Bash(<cmd>:*)` patterns. The `:*` matches any args.
Example: `Bash(gh pr:*)` matches `gh pr view`, `gh pr review`, etc.

# Bad (abstract)
When configuring tool permissions, ensure that the allowlist pattern
accommodates all anticipated subcommand invocations the agent may
need to perform during its operation.
```

Prefer the concrete form when revising.

### 4. Cite, don't expand

`see docs/manual-tests/README.md § Field ownership` is one line that beats 15 lines of duplicated content. Same with `(see Operator notes § "GH Actions YAML check")`. Skills are not the place to repeat doc that lives canonically elsewhere.

### 5. Audit on every addition

When you add a new non-negotiable or rule, scan the rest of the skill (and adjacent skills) for overlap. Two rules saying *almost* the same thing in slightly different words is worse than one rule said well — the model gets contradictory micro-signals.

Example: the `qa-soul` "spec-primacy" non-negotiable (added 2026-05-21) partially overlaps with "concrete data from spec" in the AI-assisted-authoring section. Watch for consolidation on the next pass.

### 6. Reverse-index when refactoring agents

When you convert an agent to a Python script (as we did with metrics-report, requirements-check, defect-verification, heartbeat, regression, release-gate), the skill imports it carried do **not** automatically clean themselves up. The skill file remains as an orphan documenting a workflow that no longer runs.

After any agent-to-script conversion, sweep `agents/*/CLAUDE.md` for the orphan:

```bash
for skill in skills/*.md; do
  count=$(grep -lc "skills/$(basename "$skill")" agents/*/CLAUDE.md 2>/dev/null | wc -l)
  [ "$count" -eq 0 ] && echo "ORPHAN: $skill"
done
```

If the skill has no live importer, delete it. Stale guidance about a workflow that no longer exists is worse than no guidance — it actively misleads anyone reading the repo to understand current behavior.

### 7. Periodic prune

Every 3–6 months, read each skill end-to-end and ask: *"would I still write this rule today?"* Things written as emergencies become permanent doctrine; review whether they should be. Skills accumulate weight; nobody removes it unless someone explicitly looks.

## What does NOT live here

- **Agent-specific procedure.** That goes in `agents/<name>/CLAUDE.md`.
- **Python-script implementation notes.** Those go in the script's module docstring.
- **One-off operator gotchas.** Those go in `~/.claude/CLAUDE.md` (private global) or the Operator notes section of the strategy doc.
- **Tool reference docs.** Those go in the tool's own README or the Anthropic docs we link to.
