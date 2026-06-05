# Non-PR agents and output-schema flexibility — DESIGN ARCHIVE

> **⚠️ Archived design record — partially superseded.** Scheduled / batch
> agents ARE now implemented, but via a **different design** than this doc
> proposed. The as-built behavior — `dispatch-schedule.yml` + `dispatch-core.yml`,
> the `snyk-jira-ingest → snyk-triage` chain, `private_output` (encrypted
> artifact + counts-only job-summary aggregate), and the `analysis_ref` overlay
> — is documented in **[`scheduled-batch-agents.md`](./scheduled-batch-agents.md)**.
> Read that for what exists today.
>
> This doc is kept as the design lineage. The primitives it centers on —
> `consumes_prior_run`, the `issue` output channel, and platform-computed
> `change_summary` — were **NOT built**; the `private_output` + job-summary
> model covered the security chain without them. They remain valid future work
> (see *Deferred* in the as-built doc) if a delta-tracking / notify-on-change
> agent appears. Where this doc references `PLATFORM_NOTES.md`, that file is now
> `PLATFORM_REFERENCE.md`.

Captures the design conversation from May 2026 about adding the first
non-PR agent (security-findings-triage) and the schema flexibility that
realization surfaced. Kept as a record of the design reasoning.

For context: at the time, the platform handled PR-triggered agents only. The
first proposed non-PR agent (a scheduled triage of accumulated security
findings) opened a series of design questions about scheduled dispatch,
state storage, and how universal the current output schema actually is.

---

## Motivating example

Existing scans on this repo:

- Trivy runs on every PR (via `pr.yml` → `epam/ai-dial-ci@4.0.1`).
- Trivy runs on every push to `development`/`release-*` (via `release.yml`).
- `stage-security-review.yml` runs `claude-code-security-review` on PRs.

All upload SARIF to GitHub Code Scanning. **Findings accumulate** in the
Security tab — many of them are about old dependencies, not anything the
current PR introduced.

A naive design ("PR-time triage agent reads Trivy output and posts a
comment") produces:

- Noise on every PR for findings unrelated to the diff.
- No accumulating signal across runs.
- Wrong audience (PR author isn't the security owner of an 8-month-old dep).
- No useful action (fixing an existing CVE belongs in a separate PR).

**Correct framing**: triage of accumulated security state is a
**scheduled** activity, not a PR-time one. Output goes to a tracking
issue, not a sticky PR comment. The framework's `thoughts.md` confirms
this directly:

> scheduled (e.g. nightly) — "heavy checks", human is not around, result
> is tickets

This makes security-findings-triage the **first non-PR agent** on the
platform.

---

## What the platform needs to gain

| # | Capability | Estimated effort |
|---|---|---|
| 1 | `schedule` event trigger — new dispatcher `dispatch-schedule.yml`, cron-triggered, runs matcher with `event=schedule` | ~30 min |
| 2 | `consumes_prior_run: true` manifest field — `run-agent.yml` pre-Claude step finds and downloads the prior run's `stage-output-{name}` artifact into `prior/stage-output.json` | ~30 min |
| 3 | `issue` output channel — renderer finds-or-creates a tracking issue by label, PATCHes body in place, posts a change-summary comment when material delta | ~1.5 hr |
| 4 | Renderer computes the diff from `prior/stage-output.json` + current output; injects `change_summary` as a platform-owned envelope field | ~45 min |
| 5 | `issues: write` permission tier added to `SUPPORTED_PERMISSIONS` (matcher), `dispatch-schedule.yml`, and `run-agent.yml` | ~10 min |
| 6 | Schema loosening — see *Output schema flexibility* below | ~15 min |
| 7 | `agents/security-findings-triage/` (manifest + minimal prompt) | ~30 min |

Total: ~4 hours.

---

## Output schema flexibility (the real architectural question)

This is what surfaced as the doc-worthy issue. Originally proposed
output-schema additions:

- `change_summary` at top level (issue-flavored)
- `id` field on findings (for diff identity)
- `findings[]` continues as required structure

Pushed back: the schema was creeping toward **issue/triage-specific**.
Non-reviewer agents (test-gen, spec-author, benchmark, migration,
doc-gen, dep-bump) don't fit `findings[]` at all and don't need
`change_summary`.

### Two contracts, different generality stories

| Contract | What it covers | Should it fragment per agent type? |
|---|---|---|
| **Manifest** (`agent-manifest.schema.json`) | How the agent is *wired* — triggers, permissions, tool allowlist, kill switch, lifecycle metadata | **No.** Wiring is uniform; every agent answers the same questions. |
| **Output** (`stage-message.schema.json`) | What the agent *emits* — envelope + payload | **Yes, partially.** Envelope is universal; payload shape genuinely varies by agent kind. |

The manifest stays uniform. The output schema becomes layered.

### Proposed three-tier output schema

**Tier 1 — Universal envelope (every agent)**

Required, strict, mostly platform-injected:
- `contract_version`, `stage`, `status`, `summary` (required)
- `agent_version`, `run_id`, `trigger.{event, ref, sha}` (platform-injected)
- `cost_usd` (optional, agent-emitted)
- `change_summary` (platform-injected when `consumes_prior_run: true`;
  universal for any agent tracking state across runs — not specific to
  triage or to issues)

**Tier 2 — Conventional optional payload shapes (rendered when present)**

The renderer recognizes these and presents them well:
- `findings[]` — reviewer/triage convention (severity/file/line/message/id?)

Future conventions can be added the same way (`metrics{}`,
`artifacts_created[]`, `proposals[]`, etc.) when a second agent of that
kind appears and we have real evidence of the shape.

**Tier 3 — Opaque agent-specific payload (escape hatch)**

- `payload: { type: "object", additionalProperties: true }` for
  agent-specific data the platform doesn't understand. Renderer treats it
  as opaque; links to the artifact for full content.

**Top-level `additionalProperties`**: loose (`true`). Agents can add
top-level fields freely as they evolve. When a pattern stabilizes across
≥2 agents, promote it from "novel top-level field" to a documented Tier 2
convention. (Mirrors the framework's own approach.)

### Schema delta (illustrative)

```diff
 {
-  "additionalProperties": false,
+  "additionalProperties": true,
   "required": ["contract_version", "stage", "status", "summary"],
   "properties": {
     "contract_version": { ... },
     "stage":            { ... },
     "status":           { ... },
     "summary":          { ... },
     "agent_version":    { ... },
     "run_id":           { ... },
     "trigger":          { ... },
     "cost_usd":         { ... },
     "findings":         { ... },          // unchanged — reviewer convention
+    "change_summary": {
+      "type": "object",
+      "description": "Platform-injected when consumes_prior_run is enabled. Universal for any agent tracking state across runs.",
+      "properties": {
+        "new_count":       { "type": "integer", "minimum": 0 },
+        "resolved_count":  { "type": "integer", "minimum": 0 },
+        "unchanged_count": { "type": "integer", "minimum": 0 },
+        "new_ids":         { "type": "array", "items": { "type": "string" } },
+        "resolved_ids":    { "type": "array", "items": { "type": "string" } }
+      }
+    },
+    "payload": {
+      "type": "object",
+      "additionalProperties": true,
+      "description": "Agent-specific data the platform doesn't render automatically."
+    }
   }
 }
```

### Renderer becomes a chain of optional sections

```
header (icon + stage + summary)
[findings table — if findings present]
[change summary line — if change_summary has non-zero deltas]
[payload — opaque; not rendered automatically]
footer (run URL, cost)
```

Each section is conditional. Reviewer agents get the findings table.
Scheduled agents get the change summary. Novel agents get just
header + footer + artifact link. No agent forced to fit a shape it
doesn't have.

---

## Where presentation diversity lives — `outputs[].channel`

The manifest's existing `outputs[]` declares presentation channels:

```yaml
outputs:
  - channel: pr-comment     # for reviewer/triage agents
    sticky: true
  - channel: issue          # for scheduled tracking-issue agents
    sticky: true
  - channel: check          # for branch-protection gating
  - channel: artifact       # for heavy reports
```

Channel determines **where** output lands (sticky PR comment vs tracking
issue vs check run vs artifact). Payload shape is orthogonal. Renderer
dispatches to per-channel code paths:

```
                                           ┌── pr-comment renderer → sticky PR comment
agent output (envelope + payload) ─────────┼── issue renderer ────── tracking issue
                                           ├── check renderer ────── check run
                                           └── artifact renderer ─── upload artifact
```

Each channel handles "where" and "in what wrapper"; payload conventions
(`findings[]`, `change_summary`) determine "what's in the body."

---

## Why not a `kind:` manifest discriminator

Considered routing per `kind: reviewer | generator | benchmark | ...`
with per-kind schemas. **Rejected** because:

1. **Not enough evidence**: we have one reviewer agent. The framework's
   43-agent catalog is aspirational; we don't know which agents cluster
   into the same kind until we have ≥2 of each.
2. **Premature classification**: once you commit to a fixed kind set, a
   "reviewer that also opens a PR" agent doesn't fit cleanly.
3. **Subsumed by simpler design**: envelope + optional conventions +
   opaque payload handles every case `kind:` would handle, with less
   ceremony.

If a real kind taxonomy emerges later (after 5–8 agents and observable
clustering), add `kind:` then. Don't preemptively partition.

---

## Tracking issue lifecycle (when `issue` channel is wired)

By label `agent:<name>` (e.g., `agent:security-findings-triage`):

| State on GitHub | Platform's behavior |
|---|---|
| No open issue with that label | Create new tracking issue; label it. |
| One open issue with that label | Update body in place with current run's snapshot. |
| The previous issue was closed by a human | Treat as clean slate; create a fresh issue. The closed one stays in the audit trail. |
| Multiple open issues with that label (race / human edit) | Update the most recent; warn loudly that drift exists. |

**Issue body is a rendered view, not a state store.** Never parsed back.
State lives in the artifact (`stage-output-<name>`), retained for 90 days
by GHA's default. Same separation as PR comments — explicitly documented
in PLATFORM_NOTES.

**Change notifications**: comment added to the tracking issue *only* when
`change_summary` indicates non-zero `new_count` or `resolved_count`.
Silent body update on no-op runs. Subscribers get notified on real
changes; not on every nightly run that finds the same axios CVE for the
15th time.

---

## Why diff is platform-level, not agent-level

Early sketch had the agent's prompt do the diff (read prior artifact,
compute new/resolved/unchanged, emit `change_summary`). Pushed back as
the wrong layer:

- The computation is **generic**: every scheduled agent that tracks
  state needs the same diff against a prior snapshot.
- Agent authors shouldn't write `gh run download` + jq logic in their
  prompts.
- It matches the envelope-injection pattern we already established:
  platform owns runtime-computed fields; agent owns content.

So the design becomes:

1. Platform downloads prior artifact pre-run (when `consumes_prior_run:
   true` is set).
2. Agent emits current findings (just the work; no diff logic).
3. Platform computes diff post-run from `prior/stage-output.json` +
   current output; injects `change_summary` as a platform-owned envelope
   field.

Identity key for finding equality:
- **Preferred**: agent emits optional `id` per finding (CVE id, rule id,
  etc.).
- **Fallback**: platform fingerprints from `(file, severity,
  normalized_message)` when `id` is absent.

---

## Why state is in artifacts, not the issue body

Considered storing prior triage state in the issue body and parsing it
back. **Rejected** as the same anti-pattern documented in
PLATFORM_NOTES → *Cross-run state*:

> Do not parse the sticky PR comment to recover prior state. The sticky
> comment is for humans; the artifact is for machines.

Applies identically to issue bodies. Humans edit them, formats drift,
state and presentation get conflated. Artifacts are the right state
store; issue body is just a rendered view.

---

## Why no separate "scan scheduler" today

A scheduled re-scan of `development` HEAD (to catch CVEs disclosed
against unchanged code) is a real concern. **Not blocking the triage
agent.** Decoupled by design:

- **Scans** today: PR-time via `pr.yml`, merge-time via `release.yml`.
  Findings accumulate in GitHub Security tab.
- **Triage** (proposed): scheduled, reads accumulated findings.
- **Scheduled re-scan** (deferred): a specialized self-triggered
  workflow that runs Trivy against `development` nightly. Not an agent;
  deterministic CI. Add when the "disclosure-vs-scan-gap" becomes a real
  problem.

So: one scheduler in the agent platform (triage). Re-scan, if added
later, is a normal GHA workflow file, not a manifest-driven agent.

---

## What this enables beyond security-findings-triage

The platform primitives reused by future scheduled agents:

| Primitive | Future use |
|---|---|
| `dispatch-schedule.yml` | Any cron-triggered agent |
| `consumes_prior_run: true` | Any delta-tracking agent (dep-freshness audit, license inventory drift, dead-code detector, etc.) |
| `issue` output channel | Any tracking-issue agent |
| `change_summary` envelope field | Any agent emitting deltas over time |
| `additionalProperties: true` output schema | Any agent with novel output shape |

So the work isn't just for one agent; it's the substrate for a category.

---

## Open questions to resolve before implementation

1. **Issue lifecycle on resolved findings.** If reviewers manually close
   the tracking issue and a future run finds no new findings, do we
   stay closed? Open a new issue? Update the closed one? Probably: stay
   closed until new findings appear; then open a fresh issue. To confirm.

2. **Dismissed Code Scanning alerts.** GitHub Security tab supports
   dismissing alerts ("false positive," "used in tests," "won't fix").
   Should the agent:
   - **A** — respect dismissals; never re-surface (conventional)
   - **B** — show dismissed in a separate "FYI" section so the team can
     re-evaluate periodically
   Leaning **A** by default. Can add a "monthly dismissal audit" agent
   later if needed.

3. **Identity-key fallback heuristic.** What's the actual fingerprint
   formula? `hash(file + severity + first-50-chars-of-message)` is one
   option; sensitive to message drift between Trivy DB versions. Worth
   prototyping before committing.

4. **Notification threshold.** "Material delta" = ≥1 new or ≥1 resolved?
   Or weighted (`new_high + 0.5 * new_medium`)? Or just emit on every
   change? Start simple (≥1 new or ≥1 resolved); tune from feedback.

5. **Cron schedule.** Nightly UTC 02:00 is the default placeholder;
   actual time should consider when team review is most likely to act on
   the report.

6. **Schema migration.** Loosening `additionalProperties` from `false`
   to `true` is technically a schema relaxation, not a breaking change
   for existing payloads. But it's a meaningful contract shift —
   formerly-rejected fields now accepted silently. Bump
   `contract_version` to `"0.2"` or document as a non-breaking relax of
   `"0.1"`? Cleaner is the version bump.

7. **`change_summary` for first run.** No prior artifact means
   change_summary is `{new_count: N, resolved_count: 0, unchanged_count: 0}`
   where N is total current findings? Or absent entirely? Probably
   absent — "we don't have a baseline to compare against." Renderer
   handles either case.

---

## Status

**Archived — partially superseded.** Scheduled dispatch + the first batch
agents shipped via a different design (see the banner at the top and
[`scheduled-batch-agents.md`](./scheduled-batch-agents.md)). What this doc
proposed and what actually shipped:

| This doc proposed | As-built |
|---|---|
| Single scheduled triage agent | Two-agent same-run chain (`snyk-jira-ingest → snyk-triage`) |
| `dispatch-schedule.yml` | ✅ shipped, plus a shared `dispatch-core.yml` |
| `consumes_prior_run` (cross-run state) | ❌ not built — uses same-run `needs:` |
| `issue` output channel | ❌ not built — `private_output` + counts-only job-summary aggregate |
| platform `change_summary` diff | ❌ not built |
| `issues: write` tier | ❌ not added |
| schema loosening | top-level already open; payload conventions used |

The unbuilt items remain valid future work for a delta-tracking agent.

---

## References to this session's design lineage

- `agent-cicd.md` (framework) — trigger taxonomy including `schedule`
- `thoughts.md` (framework) — "scheduled (e.g. nightly) — result is tickets"
- `agent-catalog.md` (framework) — `Triage / Code` as Phase-2 first-batch agent
- `security/agent-map.md` (framework) — `sast-triage-agent` as concrete candidate
- `security/candidates/triage-scan-results.md` (framework) — one-line description matching this design
- This repo's `PLATFORM_NOTES.md` → *Cross-run state* — the artifact-vs-comment principle that informs state storage
- This repo's `stage-message.schema.json` description — already flags the reviewer-bias trigger for non-reviewer agents
