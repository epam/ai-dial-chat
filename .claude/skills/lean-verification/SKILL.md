---
name: lean-verification
description: Run build/lint/test/typecheck verification during implementation or before merge while minimizing token spend. Use instead of raw Nx or Vitest commands, especially during an OpenSpec task slice.
---

# Lean verification

Use the narrowest verification tier that can disprove the current change. The
scripts capture full output under `tmp/agent-logs/`; successful runs return a
two-line status, while failures return a bounded excerpt and the log path.

## Verification tiers

```bash
# Red/green loop: pass one or more workspace-relative test paths.
npm run test:file -- libs/example/src/Foo.spec.ts

# Completed task or vertical slice: affected projects only.
npm run verify:changed

# Final pre-merge gate: full, non-mutating verification.
npm run verify:full
```

- `test:file` is the default during implementation. It groups paths by their
  nearest Vite/Vitest config and runs only those files.
- `test:changed` and `verify:changed` use Nx's affected project graph with
  `origin/development` as the base.
- `verify:affected` remains available as an explicit affected verification
  alias.
- `verify:full` uses `lint:check`, never the mutating `npm run lint`
  command.
- `build:quiet` builds affected projects when the change can affect bundling.

This workspace contains many Nx projects, so affected verification narrows
typecheck, lint, test, and build work to the changed projects and their affected
dependents. Prefer exact tests for the mid-task loop; reserve project-level
affected checks for a completed slice. A successful affected run may execute no
task when only docs or agent configuration changed, so it is not a substitute
for the final full gate.

## Verification cadence

Batch related edits for one task-list item before re-verifying. Do not rerun a
suite after each individual edit. OpenSpec tasks should name their exact test
files so the red/green loop does not require rediscovery.

## Failure handling

Use the printed failure excerpt first. Search or read only the relevant portion
of the saved log if that excerpt is insufficient; do not load the whole log or
rerun with a verbose reporter by default. Keep `--reporter=minimal` so passing
test logs do not enter the conversation.
