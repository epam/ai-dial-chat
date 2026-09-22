## Why

### Problem

The parent chat and the client application already share most UI packages, but still maintain the same stateful skill-import, file-attachment-picker, and prompt-selection workflows in their applications. Fixes to validation, async state, and modal transitions must be carried across repositories. The useful unit of reuse is a complete behavior contract, not an arbitrary reduction in duplicate lines.

### Solution

Extract these three workflows into existing libraries, migrate the parent application to them, and prove consumption from built npm packages with a minimal host that resembles the client application's integration boundaries.

## What Changes

- Add a headless skill import controller to `chat-hooks/skill-editor` and a labels-driven upload dialog to `skills`; keep the configured request, translations, notifications, and catalog refresh in app adapters.
- Add a file attachment picker controller to `chat-hooks/file-manager` for selection, tab transitions, and row eligibility, composing existing file-manager APIs and UI. Do not duplicate final attach validation already implemented by `chat-shared`'s `FileManagerAttachModal`.
- Add `usePromptSelectorOverlay` to `prompts`, owning favorites/browse/parameters transitions and rendering existing prompt UI with an injected catalog renderer.
- Migrate the corresponding parent wrappers and add package-consumer verification plus a concrete client application adoption guide.
- Correct obsolete app-only helper ownership in `dial-file-manager-attach-validation` without changing its user-facing validation rules.

### Non-goals

No changes to the client application in this change; no registry publication; no backend or generated-client changes; no new packages, global providers, or dependencies on application contexts. Do not extract notifications, conversations/deployments stores, version polling, date formatting, feedback UI, or small utilities such as `getConversationSource`. Do not move translation tables just to reduce file size.

### Acceptance criteria

1. Parent chat uses all three public workflow APIs; their state machines and validation orchestration no longer live in parallel app implementations.
2. Two distinct, proportionate checks cover reuse, revised from the original single combined-runtime-fixture plan after task 4.1 review: each workflow's own library test suite exercises its behavior with injected host callbacks and structural data, without parent source aliases, contexts, routing, i18n, or configured API singletons; separately, a packed-artifact consumer (the existing `chat-hooks/e2e-fixtures` for `skill-editor`/`file-manager`, plus a new minimal fixture for `skills`/`prompts`) proves the packages actually install, resolve, typecheck, and bundle outside the monorepo. Neither check renders or drives a mounted component tree against the installed tarballs; that gap is documented, not silently absorbed.
3. Current parent behavior, keyboard/RTL support, and lazy-loading boundaries remain intact; client application feature policy and catalog presentation are injectable.
4. Exported contracts and an adoption map identify what the client application can replace and what host wiring it must retain. Passing a monorepo source build alone is insufficient.

## Capabilities

### New Capabilities

- `reusable-skill-import-workflow`: Portable import state, rejection/error outcomes, and upload dialog.
- `reusable-file-attachment-workflow`: Stateful attachment picker composition over existing file-manager contracts.
- `reusable-prompt-selector-workflow`: Portable favorites, browse, parameter resolution, and insertion flow.
- `reusable-chat-workflow-consumption`: Public package contracts, parent adoption, and verification by an independent consumer.

### Modified Capabilities

- `dial-file-manager-attach-validation`: Replace obsolete app-only hidden-path and MIME helper ownership with canonical library ownership; preserve all validation semantics.

## Impact

Intentionally affects `libs/chat-hooks`, `libs/skills`, `libs/prompts`, their exports/tests/docs, the three parent app adapters, and adds one new tool project (`tools/reusable-workflows-consumer-fixture`) for packed-consumption verification. Existing `chat-shared` file-manager contracts are consumed, not redesigned. No new global provider, HTTP operation, cache, analytics transport, feature flag, or user-visible string is introduced. Existing app translation keys become supplied labels.

Observed starting points: `apps/chat/src/hooks/skills/useSkillArchiveImport.ts:89`, `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx:94`, and `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx:78`. Follow the injected-host pattern in `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx`, the existing packed-package harness in `libs/chat-hooks/e2e-fixtures/run.mjs` (chat-hooks' two new exports are already covered by its existing `skill-editor`/`file-manager` subpath fixtures), and the sibling-dependency packed-consumer pattern in `tools/attachment-canvas-consumer-fixture` (the model for the new `skills`/`prompts` fixture — see design.md Decision 5). Source references and divergences are detailed in design.md.

### Alternatives considered

| Option | Correctness and complexity | Security/performance | Migration and rollback |
| --- | --- | --- | --- |
| Keep app copies | Lowest immediate delivery risk, continued divergent fixes | No loading or trust-boundary change | No migration, recurring maintenance |
| Extract these three workflows (chosen) | Bounded contracts with two known consumers; existing primitives remain authoritative | Host clients remain injected; feature imports and lazy catalog retained | Three independent slices; revert each parent adapter without data migration |
| Extract all audited duplicates or entire providers | Broader abstractions entangle host policies; higher regression risk | Larger dependency/loading surface and risk of leaking host configuration | Coordinated migration of unrelated features; rejected |

### Compatibility and rollback

New library exports are additive and have a single owning package. Keep existing library props and exports unchanged; do not introduce forwarding exports in other packages. Parent app wrappers may remain as real adapters, not copied workflow implementations. Each slice can be reverted independently; no persisted schema or backend changes. A later client application migration must select an aligned release containing these exports; the installed `1.2.0-dev.58` is only the audit baseline, not a promised compatible release.
