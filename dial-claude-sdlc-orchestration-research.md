# SDLC Orchestration on GitHub: Prior Art and Architecture Review

Companion to [`dial-claude-sdlc-orchestration.md`](./dial-claude-sdlc-orchestration.md). The design doc proposes a spec-driven, agent-verified SDLC anchored on GitHub Actions. This document maps that design to existing named patterns, critiques it against known limitations of each pattern, and lays out three viable evolution paths with concrete decision points.

The goal is to make the doc's choices defensible by name — so future contributors search the right keywords, and so the next architectural pivot is triggered by a quoted threshold rather than a hunch.

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Pattern Map: Doc Concepts → Industry Names](#pattern-map-doc-concepts--industry-names)
- [Architecture Review](#architecture-review)
- [Three Alternative Organizations](#three-alternative-organizations)
- [Side-by-Side Comparison](#side-by-side-comparison)
- [Recommendation for DIAL Chat](#recommendation-for-dial-chat)
- [Decision Triggers for Pivoting](#decision-triggers-for-pivoting)
- [Open Questions](#open-questions)
- [References](#references)

---

## Executive Summary

The proposed SDLC orchestration is **directionally sound and not novel**. Every major construct — spec-as-contract, reusable-workflow DAGs, label/comment-triggered agents, lead-agent + sub-agents, externalized state on Phase 2 — maps onto an existing named pattern with documented strengths, limitations, and tooling.

Three findings shape the recommendation:

1. **The Phase 1 design (reusable workflows + thin orchestrator) is the right starting point** for a single repository with one or two stages. It is the most widely-used CI orchestration shape in industry and matches GitHub's own guidance.
2. **The doc's Evolution Path correctly identifies the wall** — routing logic, durable state, cross-PR history — but underweights two newer building blocks: **GitHub Agentic Workflows** (GitHub's first-party answer to agent-driven CI) and **Claude Managed Agents** (Anthropic-hosted orchestration runtime). Both reduce the YAML scaffolding the doc currently bakes in.
3. **State management is the central architectural risk.** Today's state-in-PR-comments approach is fine for linear, one-shot stages and breaks the moment you need cross-run history, severity-based routing, or a query like "what's the status of issue-4521 across 6 reruns?" The doc walks through exactly such a scenario in its worked example.

For DIAL Chat's current footprint — one stage (security-review) gated by a PR label — none of this justifies anything beyond the two-file orchestrator we just drafted. The value of this document is not to motivate immediate change; it is to **pre-commit to the threshold at which the design pivots**.

---

## Pattern Map: Doc Concepts → Industry Names

The design doc invents some vocabulary that already exists. Naming things by their accepted terms makes the design searchable, comparable, and easier to onboard new contributors to.

| What the doc calls it | Industry-accepted name | Where it's documented |
|---|---|---|
| Issue-label triggers + `/claude help` comment commands | **IssueOps** | GitHub Engineering Blog has an explicit "IssueOps" post; pattern is widely used for chatops-style automation |
| Spec → impl → verify chain with stable requirement IDs (FR-1, AC-2…) | **Spec-driven agentic SDLC** (sometimes "Specify-Plan-Tasks-Implement") | arxiv "Spec Kit Agents", Microsoft's Azure+GitHub agentic SDLC, Beam's agentic SDLC guide |
| Reusable workflows + `needs:` DAG, PR as shared state | **CI orchestration via reusable workflows** | GitHub Docs official pattern |
| "Lead Claude" + sub-agents inside a single stage | **Operator + Split-and-Merge** (Anthropic's own Claude workflow pattern taxonomy: Sequential / Operator / Split-and-Merge / Agent Teams / Headless) | Anthropic engineering blog, "5 Claude Code Workflow Patterns" |
| Spec lifecycle state diagram (Draft → NeedsRevision → Approved) | **State machine workflow** | Classic workflow orchestration concept; the diagram is correct but the *enforcement* requires external state, not GHA outputs |
| Sticky comment with JSON payload as inter-stage contract | **Pipeline-as-PR** / **state-in-VCS** | Common but recognized as a Phase-1 shortcut; durable orchestrators replace it |
| Phase 2 "externalize state + policy" | **Durable workflow orchestration** (Temporal / Restate / Inngest / Argo Workflows) | Established category; Temporal+GitHub Actions integration is a published pattern |
| Phase 2A "GitHub App + REST" | **Bot-as-orchestrator** | Probot, GitHub's own apps follow this; Optio is a recent open-source example for AI-coding agents |
| Phase 2B "MCP server" | **Agent-queryable orchestrator state** | MCP-as-orchestrator is newer (2024–2025) and the literature is thinner; expect the pattern to formalize over the next year |

**Implication:** every section in the design doc has a published prior-art trail. Reading those resources before committing to a Phase 2 path will save more time than further internal design iteration.

---

## Architecture Review

### What the design gets right

- **Reusable-workflow DAG as the execution layer at every phase.** This is the doc's strongest structural decision. Whether the orchestrator stays in GHA, moves to a GitHub App, or moves to Temporal, the *stages themselves* remain `workflow_call` workflows. That decoupling is what makes the Evolution Path credible.
- **Spec-Verify as a separate agent run with read-only tools.** Sunk-context bias is real; the author of a spec genuinely cannot adversarially review it inside the same session. Splitting these runs is correct.
- **Conformance runs first.** Cheap fail-fast against the wrong target before tokens are spent on test/security/docs is the right cost-shape.
- **`spec_id` + `spec_version` in every sticky comment.** Lets downstream stages detect staleness without scraping. This is the kind of small contract decision that scales well.
- **Stricter CODEOWNERS on `specs/` than on code.** Right answer for a spec-as-contract model.

### Where the design is shaky

#### 1. State lives in PR comments and workflow outputs

This works for *linear, one-shot stages*. It breaks for:

- **Cross-run history.** "Show me all spec revisions for issue-4521 and who approved each one" requires log scraping.
- **Resumability.** A failed stage 4 hours in cannot resume from where it crashed — only re-run from the top, paying tokens again.
- **Severity-based routing.** "If security finds a high-severity issue, escalate to humans; if medium, auto-comment; if low, suppress" is awkward in `if:` expressions and impossible to audit.
- **Cross-PR queries.** "Has anything in `specs/` changed since this PR was opened?" requires a side-channel.

The doc's worked example (Issue #4521) implicitly assumes 2 days of developer work, 2 spec revisions, and 4 verification reruns. That is exactly the regime where state-in-comments creaks.

#### 2. Routing logic in `if:` expressions

`if: github.event_name == 'pull_request'` is fine. `if: fromJSON(needs.security.outputs.message).findings[?severity=='high'] | length > 0` is the limit of YAML readability — and any branching beyond that becomes unmaintainable. The doc itself flags this as the trigger for Phase 2; the question is *when* you hit it, not *whether*.

#### 3. Human gates as GitHub `environment:` approvals

The `gate-spec-approval` and `gate-pr-review` steps use GHA environments for human approval. This works mechanically but has thin semantics:

- No first-class "who approved? when? against what spec version?"
- No way to query "show me all specs awaiting approval > 24h"
- No way to *revoke* an approval cleanly if the spec changes underneath

In a real organization, approvals are audit artifacts. GHA environments are a hack for this; a GitHub App or external orchestrator gives you proper records.

#### 4. The "lead Claude + sub-agents" pattern is conflated with the stage DAG

These are two different orchestration layers:

- **Stage-level DAG** (cross-workflow): triage → spec-author → spec-verify → … Owned by the orchestrator.
- **Sub-agent orchestration** (within a single stage's Claude run): split-and-merge for "draft current state / draft options / draft spec" in spec-author. Owned by Claude Code's own sub-agent mechanism.

The doc treats them as a continuum. They aren't. Sub-agent orchestration is *inside* one workflow run and uses Claude's own primitives; stage orchestration is *between* workflow runs and uses GHA/App/Temporal primitives. Separating these in the doc's mental model would clarify what each layer is responsible for.

---

## Three Alternative Organizations

Each option below is a complete shape, not an additive choice. Pick one.

### Option A — Stay in GHA, adopt named patterns

Smallest delta from today. Keep reusable-workflow DAG. Adopt two existing GitHub-native patterns explicitly:

- **IssueOps** for issue-side triggers. Use the GitHub-published slash-command-dispatcher pattern rather than ad-hoc comment parsing.
- **GitHub Agentic Workflows** (`.github/agents/`) for the stages that are purely "Claude does X" with a fixed prompt — security, docs regeneration, final review. These are GitHub's first-party answer to agent-driven CI and they integrate with existing reusable workflows.

State stays in PR comments. Routing stays in `if:` expressions. Acceptable up to ~3-4 stages and ~1-2 events.

**Lives well when:** repository is GitHub-native, stages are mostly independent, human gates are infrequent, audit requirements are light.

**Breaks when:** routing logic outgrows YAML; you need cross-PR history; spec revisions span days; multiple repos share the orchestrator.

### Option B — Thin GitHub App holds state and dispatches

The GitHub App becomes the system of record. GHA still runs the work (stages are still `workflow_call` workflows). The App:

- Listens to webhooks (issues, PRs, comments, check runs)
- Holds spec state, run history, approval records in its own DB (Postgres or DynamoDB)
- Dispatches workflows via `repository_dispatch` events
- Exposes a small REST surface ("show me all open specs awaiting approval", "what's the history of issue-4521?")

This is the doc's Phase 2A — and the published pattern is well-established (Probot, GitHub's own apps, recent open-source `optio` for AI-coding agents).

**Lives well when:** organization needs queryable state, audit logs, severity-based routing, cross-PR history, but stays inside GitHub.

**Breaks when:** the App becomes a stateful service the team has to operate; failure modes get harder to debug; long-running flows still need external durability.

### Option C — Durable orchestrator (Temporal / Restate / Inngest)

The orchestrator is a Temporal workflow. GHA becomes purely the execution layer (each stage is an Activity that runs a GHA workflow via the GitHub API and long-polls for completion). Temporal owns:

- The DAG and its routing logic
- Durable state (every step persisted, fully resumable)
- Retries with backoff
- Human gates as first-class workflow signals with audit metadata
- Cross-flow queries

There is a published Temporal+GitHub Actions integration pattern that covers exactly this: GitHub App auth, dispatch ID tracking, retry logic, long-polling with heartbeats.

**Lives well when:** flows span days (spec → 2-week impl → verify); resumability matters; cross-org reuse of the orchestrator is on the roadmap; audit requirements are heavy.

**Breaks when:** the team is small and doesn't want to operate Temporal; the use case is genuinely one-shot CI and durability is overkill.

---

## Side-by-Side Comparison

| Dimension | A: GHA + named patterns | B: GitHub App + GHA | C: Temporal + GHA |
|---|---|---|---|
| **State location** | PR comments, workflow outputs | App database | Temporal workflow state |
| **Routing logic** | YAML `if:` expressions | App code (TypeScript/Python) | Temporal workflow code |
| **Resumability** | Re-run from scratch | Re-run from scratch | Resume from last step |
| **Human gates** | GHA `environment:` (thin audit) | App approvals (queryable, auditable) | Temporal signals (queryable, auditable, time-bounded) |
| **Cross-PR queries** | Log scraping | Native via App API | Native via Temporal queries |
| **Severity-based routing** | Painful in YAML | Natural in App code | Natural in workflow code |
| **Multi-repo reuse** | Per-repo workflows | App installable across repos | Workflow is repo-agnostic |
| **Operational burden** | None beyond GHA | Operate the App (a service) | Operate Temporal cluster (or Temporal Cloud) |
| **Onboarding cost** | Lowest | Medium (write App, learn Probot-ish patterns) | Highest (learn Temporal SDK and operational model) |
| **Audit & compliance** | Weak (logs only) | Strong (DB rows) | Strong (workflow history) |
| **Right for** | 1–3 stages, 1–2 events, single repo | 3–8 stages, multiple events, queryable state required | Long-running flows, multi-day timelines, cross-org reuse |

---

## Recommendation for DIAL Chat

**Today: stay on Option A.** The current footprint is one stage (security-review) with one trigger path (PR + label). The two-file split already drafted (`sdlc-orchestrator.yml` + `stage-security.yml`) is the right shape and matches industry practice.

**Document the named patterns in the design doc.** Update `dial-claude-sdlc-orchestration.md` to call out:

- "IssueOps" as the name for the issue-trigger + comment-command pattern
- "Spec-driven agentic SDLC" as the umbrella term
- "Operator + Split-and-Merge" as the within-stage pattern
- Anthropic's five Claude workflow patterns as the reference taxonomy

This is a small change to the doc and a large change to its searchability.

**Plan for Option B on a specific trigger** (see below). Skip Option C unless the timelines genuinely become multi-day with resumability requirements; right now they aren't.

**Treat sub-agent orchestration inside a stage as a separate problem.** When implementing the spec-author or final-review stages, use Claude's own sub-agent primitives directly. Do not try to model them as GHA jobs.

---

## Decision Triggers for Pivoting

Pre-commit to the threshold at which the design moves. Pivoting on a quoted threshold beats pivoting on a hunch.

### Pivot from A to B when *any* of these are true

- A second event source needs cross-PR state (e.g., "has anything in `specs/` changed since this PR opened?")
- Routing logic requires more than two `if:` clauses or any non-trivial JSON traversal in YAML
- Human approval records need to be queried as audit artifacts (not just present in logs)
- Severity-based escalation (high → human, medium → comment, low → suppress) becomes a real requirement
- A second repository wants to use the same orchestration

### Pivot from B to C when *any* of these are true

- Stage timelines routinely exceed 24 hours and a failed step costs >$10 in tokens to re-run
- A flow needs to wait on external state for >1 hour with retries (e.g., human approval, async vendor API)
- More than 5 stages have non-trivial inter-stage dependencies
- Compliance requires immutable workflow audit history

### Do not pivot when

- Token cost is the only pressure — that's a prompt/sub-agent problem, not an orchestration problem
- The team complains about YAML — first try Option A's named patterns; YAML is fine for 80% of cases
- A single stage is slow — fix the stage, not the orchestrator

---

## Open Questions

These are *not* answered by the research and should be resolved before committing to anything beyond Option A:

1. **Audit retention requirements.** How long must spec approvals, security review records, and final-review verdicts be retained, and in what form? Answer determines whether GHA logs are acceptable or whether B/C is mandatory.
2. **Multi-repo scope.** Will this orchestration eventually serve other AI DIAL repos (e.g., the core service, plugins, sdk-js)? Yes → favor B or C earlier.
3. **DIAL Application integration.** The Evolution Path's Phase 3 hosts the orchestrator in DIAL itself. Is that a real roadmap item or an aspirational note? Real → B becomes a stepping stone, not a destination.
4. **Human gate timeouts.** What happens if a spec sits "awaiting approval" for 5 days? GHA environments have no native timeout semantics; B/C do.
5. **Sub-agent budget per stage.** Are spec-author runs allowed to spawn arbitrary sub-agents, or is there a token budget per stage? Affects how aggressively "Operator + Split-and-Merge" is used.

---

## References

### Pattern documentation

- [IssueOps: Automate CI/CD with GitHub Issues and Actions (GitHub Engineering Blog)](https://github.blog/engineering/issueops-automate-ci-cd-and-more-with-github-issues-and-actions/)
- [Automate repository tasks with GitHub Agentic Workflows (GitHub Blog)](https://github.blog/ai-and-ml/automate-repository-tasks-with-github-agentic-workflows/)
- [GitHub Agentic Workflows — home](https://github.github.com/gh-aw/)
- [Reuse workflows — GitHub Docs](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)
- [What is Workflow Orchestration? (GitHub Resources)](https://github.com/resources/articles/what-is-workflow-orchestration)
- [What is AI Agent Orchestration? (GitHub Resources)](https://github.com/resources/articles/what-is-ai-agent-orchestration)

### Claude / Anthropic patterns

- [Best practices for Claude Code (Anthropic Engineering)](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Beyond One-Shot Prompts: 5 Claude Code Workflow Patterns](https://www.mindstudio.ai/blog/claude-code-agentic-workflow-patterns)
- [Code with Claude 2026: New Agent Features](https://www.mindstudio.ai/blog/code-with-claude-2026-new-agent-features)
- [Inside Claude Code Auto Mode: Autonomous Coding with Human Approval Gates (InfoQ)](https://www.infoq.com/news/2026/05/anthropic-claude-code-auto-mode/)
- [How Anthropic teams use Claude Code (Anthropic PDF)](https://www-cdn.anthropic.com/58284b19e702b49db9302d5b6f135ad8871e7658.pdf)

### Spec-driven agentic SDLC

- [How We Built a 16-Agent SDLC That Ships Features End-to-End](https://medium.com/@brettluelling/how-we-built-a-16-agent-sdlc-that-ships-features-end-to-end-2a3621fc9e64)
- [An AI-led SDLC: End-to-End Agentic SDLC with Azure and GitHub (Microsoft)](https://techcommunity.microsoft.com/blog/appsonazureblog/an-ai-led-sdlc-building-an-end-to-end-agentic-software-development-lifecycle-wit/4491896)
- [The Complete Guide to Agentic Software Development in 2026 (Beam)](https://getbeam.dev/blog/agentic-sdlc-complete-guide.html)
- [Building a Fully Autonomous AI SDLC Pipeline with Multi-Agent Systems (n1n.ai)](https://explore.n1n.ai/blog/autonomous-ai-sdlc-pipeline-multi-agent-2026-03-14)
- [Spec Kit Agents: Context-Grounded Agentic Workflows (arxiv)](https://arxiv.org/pdf/2604.05278)
- [What Are Agentic Design Patterns? 2026 Pattern Catalog (Augment Code)](https://www.augmentcode.com/guides/agentic-design-patterns)
- [How agentic AI will reshape engineering workflows in 2026 (CIO)](https://www.cio.com/article/4134741/how-agentic-ai-will-reshape-engineering-workflows-in-2026.html)

### Durable orchestration

- [Running GitHub Actions through Temporal: A Complete Guide (Temporal Blog)](https://temporal.io/blog/running-github-actions-temporal-guide)
- [Temporal vs Airflow vs Argo: Workflow Orchestration Guide](https://www.xgrid.co/resources/temporal-vs-airflow-vs-argo-workflow-orchestration/)
- [Argo Workflows](https://argoproj.github.io/workflows/)
- [Top Open Source Workflow Orchestration Tools (Bytebase)](https://www.bytebase.com/blog/top-open-source-workflow-orchestration-tools/)

### Reference implementations

- [Optio — Workflow orchestration for AI coding agents (GitHub)](https://github.com/jonwiggins/optio)
- [argo-workflows — Workflow Engine for Kubernetes (GitHub)](https://github.com/argoproj/argo-workflows)
