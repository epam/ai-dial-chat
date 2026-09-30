## Why

### Problem

DIAL Core now describes nested stages through optional `parent_stage_index` ([SDK contract change](https://github.com/epam/ai-dial-typescript-sdk/commit/a5b2b35023d145171162c1a3630cdee9a19ac047)). Chat already has expandable stage bodies and repeated-attempt groups, but neither represents parent/child relationships. Users currently see a flat sequence instead of which operation produced each substep.

The field refers to the parent's streaming `index`, is sent only when the child opens, and refers to the parent's array position in non-streaming payloads without indexes. Supporting only the visual indentation would leave history normalization and the documented conversation contract incomplete.

## What Changes

### Solution

- Carry optional `parent_stage_index` through `Stage`, raw-stage normalization, the backend `StageDto`, and its generated OpenAPI model. Preserve it across subsequent deltas that omit it.
- Normalize complete arrays without stage indexes using their positions; preserve explicit indexes in streamed/persisted arrays. Use the existing mapper at the app's stage-rendering boundary as well as supporting its existing library consumers.
- Derive a tree from the flat stage array and render children inside their parent's existing disclosure, at multiple levels. Parents with children are expandable even without their own text or attachments.
- Apply the existing consecutive-name `×N` grouping separately to each sibling list, keeping every attempt's children attached to that attempt.
- Preserve per-stage status semantics, attachments, summaries, existing theme/label props, and flat-payload behavior. Unknown or invalid parent links fall back to a top-level row.
- Verify nested display during streaming, after replay/reload, on mobile, and in RTL.

The user confirmed reuse of the current interface: children inside the parent disclosure, sibling-scoped `×N`, and local expansion state. No new React context is needed.

### Non-goals

- New endpoints, a new persistence representation, a global stage store, or additional feature flags.
- Overlay `postMessage` protocol changes, multi-choice completion support, or synthesizing nested stages for Responses API events.
- Changing duration calculations, propagating a child's status onto its parent, or redesigning the stage UI.
- Upgrading the SDK wholesale: the linked commit also changes pricing, which is outside this change.

### Alternatives considered

1. **Keep the flat renderer:** smallest change and valid upstream fallback, but does not deliver the requested hierarchy.
2. **Derive a display tree from the existing flat data (selected):** additive contract, linear tree construction, and reuse of current components; no storage migration or transport redesign.
3. **Persist nested `children` arrays:** duplicates protocol information and complicates incremental merging, export and rollback without improving this UI requirement.

## Capabilities

### New Capabilities

None. Extend the existing stage capabilities.

### Modified Capabilities

- `stage-visualization`: parent references, snapshot normalization, nested disclosures, sibling-only retry grouping, and stage-rendering integration.
- `server-chunk-assembler`: preservation and documented validation of optional parent references through assembly and conversation serialization.

## Impact

- **Observed references:** `libs/chat-shared/src/models/chat.ts:156` defines a flat `Stage`; `libs/chat-hooks/src/conversation/stage.ts:80` selects fields and defaults a missing index to zero; `libs/chat-hooks/src/conversation/useConversationStream/apply-chunk.ts:107` and `apps/chat-api/src/conversations/utils/apply-chunk-stages.server.ts:49` already merge by index using object spreads. Follow those merge patterns, adding regression coverage rather than rewriting the assembler.
- **Renderer model:** follow `libs/conversation-stages/src/components/StagesPanel/StagesPanel.tsx:171`, `libs/conversation-stages/src/components/StageItem/StageItem.tsx:118`, and `libs/conversation-stages/src/utils/stage-grouping.ts:6`. Existing grouping is by name, not parentage.
- **App boundary:** `apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:976` currently passes message stages directly. It will supply normalized `Stage[]` through the existing `stages` prop. `onAttachmentClick`, `styles`, `labels`, and `isStreaming` remain host-supplied; libraries gain no API URLs, app contexts, i18n imports, storage, or SDK setup.
- **Shared-library scope:** changes are necessary in `chat-shared`, `chat-hooks`, and `conversation-stages`; `chat-api-client` changes only through generation from `apps/chat-api/src/conversations/dto/stage.dto.ts`. No new library, provider, dependency, or library-isolation exception.
- **API:** additive model change on existing conversation payloads; paths, operation names, authorization and error codes are unchanged. Whole-conversation save currently uses an object-only envelope, so do not claim it already performs nested stage validation or tighten that unrelated behavior.
- **i18n:** preserve the labels-prop boundary; complete the app's translated stage-label wiring for nested disclosures and existing attempts/status/actions. No new nesting-specific wording is required.
- **Docs:** update the three affected library READMEs during implementation. The architecture's current stage-library summary remains accurate; there is no structural or protocol-boundary change requiring an architecture rewrite.

### Acceptance criteria

1. Parent `0`, multiple roots, interleaved siblings, and at least three levels display correctly; no stage is duplicated or lost.
2. A child keeps its parent after content/status/attachment deltas that omit the field and after backend persistence and reload.
3. Unindexed snapshots acquire distinct positional indexes and render the same hierarchy; explicitly indexed snapshots retain their original identities.
4. Parent-only containers can be expanded; retries group only within one sibling list and retain their own descendants. Existing flat payloads keep their current behavior.
5. Missing/invalid parent references safely become roots; child status does not overwrite parent status, and message-wide counts include every stage exactly once.
6. Keyboard disclosure behavior, hidden-region focus handling, mobile layout, RTL, existing attachment callbacks, and localized labels are covered by automated verification.
7. OpenAPI generation/checks, relevant tests, library boundary checks, documentation validation, and the final repository verification pass.

### Backward compatibility and rollback

The wire/storage shape remains a flat array with one optional field. Old payloads require no migration. Roll back the hierarchy renderer independently while retaining the additive DTO/model allowance, so existing saved parent metadata remains accepted. Avoid removing the field from request validation once clients can send it. There is no new cache, telemetry event, configuration or feature gate.
