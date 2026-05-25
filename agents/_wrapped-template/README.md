# Wrapped agent template

A **Wrapped** agent runs a third-party GitHub Action under our governance — as
opposed to **Native** agents (the common case), which run a Claude prompt via
the generic composite action.

## When to use

- The work is done by a purpose-built Action (Trivy, Semgrep, CodeQL,
  `claude-code-security-review`, etc.) that you want under our agent catalog.
- The Action's output goes directly into PR review channels (sticky comments,
  the GitHub Security tab, check runs).
- The agent doesn't fit `prompt + tool allowlist + structured JSON output` —
  i.e., it's not a generic Claude task.

## How it works mechanically

GHA's `uses:` field is evaluated at workflow parse time and **does not accept
expressions**. So each Wrapped agent needs **its own self-triggered workflow
file** that hardcodes the third-party action reference. The dispatcher doesn't
route Wrapped agents — they fire on their own.

```
agents/<wrapped-name>/
├── agent.yml                 ← catalog/governance metadata only
└── README.md                 ← (this file, or agent-specific notes)

.github/workflows/
└── stage-<wrapped-name>.yml  ← the actual workflow that runs on PR
```

The matcher **skips** agents whose `invocation.pattern: wrapped` (so they
don't end up in `dispatch-pr.yml`'s matrix). The specialized workflow handles
its own:

- trigger (`on: pull_request: …`)
- permissions block
- concurrency
- kill switch (`if: vars.STAGE_<NAME>_ENABLED != 'false'`)
- output (sticky comment via `gh api`, or whatever channels the wrapped action supports)

## Reference example

`.github/workflows/stage-security-review.yml` wraps
`anthropics/claude-code-security-review`. Read it as a template; copy and
edit when adopting a new third-party action.

## Onboarding checklist

1. Vet the third-party action: pin to SHA, review its source, confirm scopes
   (`vet-agent` skill output is the input here).
2. Drop `agents/<wrapped-name>/agent.yml` from this template; fill in
   `name`, `source.url`, `source.sha`, `invocation.action_ref`, license.
3. Create `.github/workflows/stage-<wrapped-name>.yml` from
   `stage-security-review.yml` as a starting point. Adapt:
   - Replace the action call with your third-party action (pinned by SHA).
   - Adapt the output mapping — if the action emits its own PR comments, you
     may want to set its `comment-pr: false` and post via our sticky-comment
     convention instead.
   - Add the kill-switch `if:` to the job.
4. Test on a draft PR. Verify the sticky-comment marker matches the agent name.
5. Register kill-switch convention: var name = `STAGE_<NAME_UPPER>_ENABLED`.

## What the platform handles for you (Native)

| Concern | Native | Wrapped |
|---|---|---|
| Workflow YAML | dispatcher + run-agent.yml | your own `stage-<name>.yml` |
| Permissions block | platform (run-agent.yml) | you declare in your workflow |
| Concurrency | platform | you declare |
| Kill switch | platform (matcher prunes) | you add `if:` to the job |
| Output schema | platform-enforced via `--json-schema` | the third-party action's native format |
| Sticky comment | platform (composite action) | you (often via `gh api`) |
| Artifact upload | platform (composite action) | optional, you decide |

## Why we don't centralize Wrapped agents

The framework's reference design imagines a single `run-agent.yml` that
handles both Native and Wrapped via per-agent adapters. GHA's `uses:` field
**cannot be templated from expressions**, which makes that vision
unimplementable as-is. Per-agent specialized workflows are the GHA-native
equivalent. The cost: each Wrapped agent adds one workflow file (and
typically that file is short — under 50 lines).

See `.github/claude/PLATFORM_NOTES.md` → *Native vs Wrapped agents* for the
broader rationale.
