## Why

### Problem

Ten app-owned algorithms and controllers duplicate behavior that can be shared through existing libraries. Manual copying causes fixes to diverge and risks carrying host-specific ID parsing, routing and storage policy into reusable code.

## What Changes

### Solution

- Extract all ten controllers in ordered, independently verified slices: browser download; scheduled-run grouping; conversation discovery; scheduled-skill display names; skill file-system picker; canvas request coordination and file preview; entity-preselection controller; attachment-result state; canvas width calculation; generic persisted state.
- Publish additive APIs from existing owning packages and existing thematic entries where possible. Parent `apps/chat` must use them in each extraction slice, retaining compatibility adapters where existing specs require app exports.
- Pass identity/session keys, ID normalization/group keys, configured API callbacks, canvas callbacks, storage adapters, layout values, and notification events across explicit boundaries. Keep routing, auth, contexts, feature flags, translations and URL construction in the app.
- Extend packed-consumer verification and the host integration guide, including the three already-exported APIs: offline-credentials login, usage-reset formatting and conversation-source classification.

### Non-goals

No backend/API changes, new package, new UI, strings or feature flags. No wholesale provider/catalog/container migration; no repeated extraction of existing skill-import, prompt-selection, file-picker or draft engines. Registry publication and application migrations outside this workspace are not part of this change. Existing timezone policy remains unchanged.

## Capabilities

### New Capabilities

- `reusable-chat-controllers`: public controller/utility contracts for the ten extracted controllers, host boundaries, parent adoption, concurrency behavior and independent package consumption.

### Modified Capabilities

None. Existing `scheduled-task-conversation-grouping`, `scheduled-task-unread-tracking`, `url-entity-preselection`, `file-manager-preview`, `reusable-file-attachment-workflow` and `chat-hooks-viewport-layout` behavior remains authoritative. Keep their named app exports as thin adapters; the new capability adds reusable ownership without removing those contracts.

## Impact

Scope deliberately crosses shared libraries and provider wiring: `libs/chat-hooks`, `libs/attachment-canvas`, their exports/build fixtures, and the matching app hooks/utilities. No global app provider is moved into a library. Reuse the existing canvas provider for per-canvas coordination; no new global app context is needed.

Independent package consumption requires correct sibling
declarations/metadata in `libs/skill-editor`, `libs/chat-shared` and
`libs/mcp-apps`, plus the fixture's redundant peer overrides. These changes
make the existing public type closure consumable; they do not introduce new
feature behavior or change locked dependency versions.

The app adapters in `apps/chat/src/utils/file-download.ts` and `apps/chat/src/hooks/attachment/useLatestCanvasRequest.ts` delegate to library exports. `apps/chat/src/hooks/conversation/useConversationDraftStore.ts` and `libs/chat-hooks/src/files/useFileAttachmentPicker/useFileAttachmentPicker.ts` provide existing examples of host adapters and callback injection.

### Alternatives

| Option                                         | Correctness and delivery                                    | Security/performance                                                | Migration and rollback                                    |
| ---------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| Keep copies and sync fixes                     | Lowest initial effort; drift persists                       | Duplicated concurrency and parsing fixes                            | No release work; repeated manual sync                     |
| Move full providers/containers                 | Broad coupling and high regression risk                     | Pulls host auth/routing and eager UI dependencies across boundaries | Large coupled rollback                                    |
| Extract bounded controllers in slices (chosen) | Tests preserve behavior; differences become explicit inputs | Retains boundary rules, cancellation and lazy loading               | Additive exports, adapters, reversible per-slice adoption |

### Acceptance criteria

1. All ten items have one library implementation used by the parent; local files retain only integration/compatibility adapters.
2. Characterization and host integration suites preserve existing semantics, including both ID formats via injection, stale-request protection and storage fallback.
3. Packed public artifacts typecheck and bundle outside workspace aliases, with all public types and dependency declarations present.
4. Documentation describes each public API, its required host adapters and package dependencies. Existing exports remain compatible.
5. Library boundary checks and the planned slice/final verification pass. No new visible strings, accessibility behavior or RTL layout is introduced.

### Backward compatibility and rollback

Keep existing public package exports and app-level entry contracts. Pin a compatible aligned artifact set for consumers. Revert a parent adoption slice and its corresponding extraction if necessary; no persisted-data migration or backend rollback is involved. Registry publication is a separate release operation. Existing storage codecs, layout values and route policies remain host-owned.
