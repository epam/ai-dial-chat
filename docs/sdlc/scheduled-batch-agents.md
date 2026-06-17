# Scheduled & batch agents — as-built

**Status: implemented.** This describes how non-PR (scheduled / manually
dispatched / batch) agents actually work on the platform today. For the
original design exploration — including primitives that were proposed but
*not* built this way (`consumes_prior_run`, the `issue` output channel,
platform-computed `change_summary`) — see the design archive at
[`scheduled-agents.md`](./scheduled-agents.md).

The first batch agents are the security chain `snyk-jira-ingest → snyk-triage`,
which triage the standing Snyk SAST backlog rather than gate a PR.

---

## How it differs from PR agents

A PR agent gates a diff and posts a sticky comment. A batch agent processes a
**standing backlog** (the accumulated Snyk findings), on a schedule, with no PR
and no human waiting. Two consequences shaped the build:

- **Output goes to the Actions run, not a PR comment.** Sensitive agents emit
  only **aggregate counts** to the job summary; full detail lives in an
  **encrypted artifact**. (The design archive proposed a tracking-*issue*
  channel + `change_summary`; that was not built — `private_output` +
  job-summary aggregate is the as-built model.)
- **The analyzed code is decoupled from the trigger.** A scheduled run fires
  from the default branch, but triages findings scanned against another branch.
  `analysis_ref` bridges that (see below).

---

## Dispatch architecture

One reusable core, three trigger-specific entry points:

```
dispatch-pr.yml         (on: pull_request)        ─┐
dispatch-schedule.yml   (on: schedule,             ├─→ dispatch-core.yml ─→ run-agent.yml (per agent)
                             workflow_dispatch)    ─┘     (gate → discover → rounds)
```

- **`dispatch-core.yml`** — the shared pipeline (`workflow_call`). It reads the
  caller's event from `github.event_name`, runs the matcher for that event, and
  fans agents out into topologically-sorted rounds. The same core serves
  `pull_request`, `schedule`, and `workflow_dispatch` without modification.
- **`dispatch-schedule.yml`** — `on: schedule` (cron `0 6 * * *`, daily 06:00
  UTC) + `workflow_dispatch` (manual "Run workflow" button). Delegates to
  `dispatch-core.yml`.
- **`dispatch-pr.yml`** — `on: pull_request`. Also delegates to the core.

### The default-branch constraint

GitHub registers `schedule` and `workflow_dispatch` **only when the workflow
file is on the repository's default branch** (`development`). So on a non-default
branch (e.g. the `sdlc-test-base` sandbox) neither the cron nor the manual button
fires. While the framework lives on the sandbox base, the batch agents keep a
**temporary `pull_request` trigger** purely so the chain can be smoke-tested via
a PR; once the framework lands on the default branch, the cron + manual button go
live and the sandbox `pull_request` trigger can be dropped from the manifests.

Note this is independent of *which code is analyzed*: the workflow runs *from*
the default branch but analyzes whatever `analysis_ref` names (see below).

---

## Declaring a batch agent

```yaml
triggers: [pull_request, schedule, workflow_dispatch]
```

`schedule` / `workflow_dispatch` are matched by the same matcher logic as
`pull_request`; trigger filters (`branches`, `labels`) only apply to PR events,
so a scheduled agent matches purely on the trigger.

The two security agents chain in-run via `needs:` (not cross-run):

- **`snyk-jira-ingest`** (round 1) — pulls the real Snyk findings from EPAM Jira
  via a PAT (`secrets: [JIRA_PAT]`), emits them under `payload`.
- **`snyk-triage`** (round 2, `needs: [snyk-jira-ingest]`) — validates each
  finding against repo evidence and emits per-finding verdicts.

---

## `analysis_ref` — analyze a different branch than you run from

A batch agent's findings were scanned against a specific branch; their file
paths/line numbers only resolve against *that* branch's source. `analysis_ref`
names it:

```yaml
analysis_ref: development
```

`run-agent.yml` fetches that ref and **overlays its source** onto the working
tree, preserving the framework paths (`.github`, `.claude`, `agents`) so the
composite action, skills, and trusted manifest survive. It also captures the
ref's SHA so an `emit_sarif` upload is scoped to the scanned commit. The agent
reads the findings' repo-relative paths directly — no skill awareness of
branches needed. See [`PLATFORM_REFERENCE.md`](../../.github/claude/PLATFORM_REFERENCE.md)
→ *Analysis-ref overlay* for the full mechanism and trust properties.

To run triage against `development-1.0` instead, set `analysis_ref:
development-1.0` — but the *ingested findings must also correspond to that
branch* (the overlay aligns the code; the ingest still supplies whatever the
Jira filter returns).

---

## Output: private (encrypted) + aggregate

Batch agents over a security backlog are sensitive and this repo is public, so:

```yaml
private_output: true
secrets: [SDLC_ARTIFACT_KEY]
```

- **`private_output: true`** → the agent's `stage-output.json` is AES-encrypted
  (`SDLC_ARTIFACT_KEY`) before upload; the plaintext is consumed on the runner
  first (render / SARIF) then removed. A downstream agent's `run-agent.yml`
  decrypts the upstream artifact it consumes.
- **Public surface = counts only.** Instead of a full sticky comment, sensitive
  agents publish an **aggregate (counts-only)** report to the Actions **job
  summary** — no file paths, no per-finding verdicts. The job summary is
  world-readable on a public repo; counts are safe, detail is not.
- **`emit_sarif: true`** (optional; currently paused) → converts
  `payload.findings[]` to SARIF 2.1.0 and uploads to the Security tab, scoped to
  `analysis_ref`'s branch/commit. A write-access-gated surface, unlike the public
  job summary.

Both the **input** (composed prompt + agent-facing schema, as
`stage-input-<name>`) and **output** (`stage-output-<name>`) are persisted as
audit artifacts (90-day retention), encrypted for `private_output` agents.

---

## Security on the batch path

The round-0 trust gate (`pr-trust-gate`, ADR-0005 M1/M2) runs in
`dispatch-core.yml`, but it is a **no-op for `schedule` / `workflow_dispatch`**:
those have no PR and run from the trusted default branch, so there's no fork
surface to gate. The `analysis_ref` overlay still preserves `.github` / `.claude`
/ `agents` from the trusted base as defense-in-depth, even though the analyzed
ref (an internal branch) is itself trusted. See
[`PLATFORM_REFERENCE.md`](../../.github/claude/PLATFORM_REFERENCE.md) →
*Security model*.

---

## Deferred (designed, not built)

These primitives from the [design archive](./scheduled-agents.md) were **not**
built — the `private_output` + job-summary-aggregate model covered the security
chain's needs without them. Revisit if a delta-tracking or notify-on-change
agent appears:

| Primitive | What it would add |
|---|---|
| `consumes_prior_run: true` | Download the *prior run's* artifact pre-run (cross-run state, vs today's same-run `needs:`). |
| `issue` output channel | Post/maintain a tracking issue by label instead of a job-summary aggregate. |
| platform-computed `change_summary` | new/resolved/unchanged deltas vs the prior snapshot, injected as an envelope field. |
| `issues: write` permission tier | Required by the `issue` channel; not in `SUPPORTED_PERMISSIONS` today. |

---

## File map

| File | Role |
|---|---|
| `.github/workflows/dispatch-core.yml` | Shared dispatch pipeline (gate → discover → rounds) |
| `.github/workflows/dispatch-schedule.yml` | `schedule` + `workflow_dispatch` entry point |
| `.github/workflows/dispatch-pr.yml` | `pull_request` entry point |
| `.github/workflows/run-agent.yml` | Per-agent runner: artifact download, secret/var inject, `analysis_ref` overlay, encrypt/decrypt |
| `.github/claude/scripts/findings-aggregate.py` | Counts-only aggregate for `private_output` agents |
| `.github/claude/scripts/findings-to-sarif.py` | `payload.findings[]` → SARIF for `emit_sarif` |
| `agents/snyk-jira-ingest/agent.yml`, `agents/snyk-triage/agent.yml` | The first batch chain |
