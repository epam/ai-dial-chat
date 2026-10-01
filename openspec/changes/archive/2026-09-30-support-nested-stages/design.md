## Context

The [upstream SDK commit](https://github.com/epam/ai-dial-typescript-sdk/commit/a5b2b35023d145171162c1a3630cdee9a19ac047) defines two representations of the same relationship:

| Payload | Stage identity | Parent reference |
| --- | --- | --- |
| Streaming delta | Explicit `index` | Parent's `index`; supplied only when the child opens |
| Complete non-streaming array | Array position; `index` omitted | Parent's array position |
| Chat's persisted assembled stream | Explicit `index` retained by the current assembler | Preserve the original parent index |

The upstream guarantees parent-before-child, same choice, and `parent_stage_index < index` in streaming responses. Unknown parents must display at the top level. This change retains Chat's existing first-choice consumption.

Current implementation evidence:

- `Stage` (`libs/chat-shared/src/models/chat.ts:156`) and `StageDto` (`apps/chat-api/src/conversations/dto/stage.dto.ts:43`) have no parent field.
- Both `mergeStages` implementations spread old and incoming objects. A runtime parent field already survives an omitted-field delta; tests and types are missing. Do not replace the merge algorithm without a failing case.
- `toStage` explicitly selects fields and supplies index zero (`libs/chat-hooks/src/conversation/stage.ts:80`). `mapStages` currently applies it identically to every array item. The main chat renderer bypasses these helpers (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx:976`). Thus the reusable mapper and actual app integration both need attention.
- `StagesPanel` applies consecutive-name grouping to the full flat list. `StageItem` reveals only markdown/attachments, and `CollapsedGroup` computes counts and duration from the full input array.
- `MessageCustomContentDto.stages` has nested DTO validation. In contrast, `SaveConversationBodyDto.conversation` has `@IsObject()` only; extending `StageDto` must not silently turn full-conversation save into a newly strict validator.
- `openspec/specs/stage-visualization/spec.md` explicitly requires a flat renderer. Update that requirement through a rename and full modified block. Its historical `saveConversation` scenario also predates backend-owned generation persistence; update only that stage-persistence scenario to name the current owner.

The user confirmed retaining existing disclosures, grouping retries within siblings, and local expansion state. Backend details follow `apps/chat-api/AGENTS.md`, especially §§3, 5 and 11. Library changes follow root `AGENTS.md` isolation rules, `.claude/rules/libs.md`, and `.claude/rules/lib-styling.md`.

## Goals / Non-Goals

**Goals:** preserve parent metadata end to end; render multiple levels with the existing stage controls; correctly handle index-free history; retain flat-input compatibility, per-stage status and host callbacks; cover mobile, RTL and keyboard interaction.

**Non-Goals:** new REST operations, nested storage, additional context/provider, SDK/pricing upgrades, overlay message schema changes, extra completion choices, Responses API event synthesis, new duration semantics, or unrelated DTO/attachment cleanup.

## Decisions

### 1. Keep flat data and add one optional field

Add `parent_stage_index?: number` to `Stage` and `StageDto`, and the matching optional input on `RawStage`. The normalized public `Stage` remains indexed. Preserve the snake_case name alongside the current wire-shaped models; a second camelCase alias would create unnecessary conversion work.

Describe the field in Swagger as an optional integer with minimum zero. Validate a present value as a nonnegative integer in existing nested-validation paths. Omitted metadata means root; normalization treats nullish parent input as absent for compatibility, without documenting null as a new wire value. The visual relation validator, not a new backend graph validator, handles unknown/self/forward parent references.

Generate `libs/chat-api-client/openapi.json` and `src/generated` from the DTO. Existing `ConversationsApi` methods, singleton, and wrappers remain the transport. No new dependency on the upstream SDK is required because assembly already uses local stage DTOs.

Alternative rejected: storing `children` in conversation data. It duplicates the protocol and would force every chunk merger and saved history consumer to understand a new shape.

### 2. Normalize complete arrays at the display boundary

`toStage` preserves a present parent field, including zero. Keep its existing single-stage index-zero fallback for source compatibility. In `mapStages`, supply the array position when an entry has no explicit index before calling `toStage`; explicit indexes remain untouched. Do not infer indexes from positions in partial SSE updates or normalize partial updates with `toStage`, since its defaults can overwrite accumulated values.

`ConversationMessageItem` derives normalized stage props using `useMemo` keyed by the source stage-array reference, then passes them to `CollapsedGroup`. This covers freshly loaded history, completion reload, initial conversation data and restored live messages through one render boundary. It does not rewrite the saved message, drop other custom content, or add a transport call. Downstream hosts retain the reusable `mapStages` helper for the same conversion.

Canonical complete arrays have either explicit indexes or no indexes, as specified upstream. This change does not invent a new mixed-identity wire format. Sparse explicit indexes are supported and never confused with array offsets.

### 3. Preserve sparse metadata during assembly

The frontend `useConversationStream` and backend generation service keep owning message data. A child-opening delta supplies its parent once. Later deltas without that property preserve it while names/content concatenate, attachments merge, and status changes affect only the addressed stage.

Use shared fixture shapes in frontend and backend tests, without introducing an app-to-app import. Verify persistence in the existing generation-service suite and reload through the generated REST client. The existing object-spread behavior is adequate for omitted fields; only change production merge code if the regression exposes a loss. A child update never marks its parent completed or failed.

### 4. Build a display forest before grouping siblings

Add an internal pure `buildStageTree` utility under `libs/conversation-stages/src/utils/stage-tree.ts` with internal node types under `models/stage-tree.ts`. Nodes reference the original normalized stage and own a child-node list; do not mutate input or add `children` to `Stage`.

Build a map by stage index, then attach each node exactly once. An edge is usable only when the parent reference is an integer at least zero, resolves in this message's stage set, and is less than the child's index. Otherwise place the node among roots. Strictly decreasing parent indexes prevent cycles without recursive ancestor scans. Preserve input encounter order among roots and among children. Tree derivation is O(n) in time and auxiliary space and uses no depth-dependent full-array filtering.

Apply the existing cleaned-name rule to consecutive nodes in each sibling list **after** tree construction. For `[P0, C1(parent=0), P2, C3(parent=2)]` with equal names on P0/P2, the two parent attempts may group, but each keeps its own child. Equal child names under different parents never group together. Group attempts hold nodes rather than dropping children back to plain stages.

Alternative rejected: grouping the original flat array before nesting. It loses hierarchy and lets identical labels from different parents share a retry row.

### 5. Reuse disclosure components and keep state local

`StagesPanel` owns a memoized forest and renders an internal recursive sibling-list component. `StageItem` gets an internal child-content slot so it can display its own markdown, then attachments, then its child list without importing `StagesPanel` back into itself. Presence of children makes the row expandable even when its own body is empty. Do not put child controls inside the parent's header button.

Use the existing UI-kit 2.0 `Accordion`, preserving its real-component tests. Confirm its current public contract through the kit MCP during implementation; no new control or dependency is proposed. Stage and retry disclosures start collapsed, matching existing behavior. The outer `CollapsedGroup` keeps its current streaming-open and completion-collapse policy.

Keep disclosure state within the panel/component subtree, keyed by stable stage indexes (retry groups by their first attempt), never by streaming names or content. For a still-present stage, token/status updates and added siblings must not reset the user's choice; preserve stage choices when a second attempt creates a retry group. No persistence or React context. Controlled internal props can carry panel-local state through the recursive list if needed.

All stage icons still use their own explicit status. A completed parent with a running child stays completed while the child remains live. The existing outer summary still scans every flat stage once, including child failures; step count is the total flat-array length. Duration calculations keep the existing interval-union and duration-only fallback rules, including the latter's pre-existing limitations. A retry summary computes over its attempts, not an additional recursive duplication of descendants.

### 6. Bound visual indentation and preserve accessibility

Keep semantic nested `ul`/`li` lists and standard disclosure buttons rather than adding ARIA tree navigation. Buttons expose `aria-expanded` and control their own region; Enter/Space toggle the focused disclosure. Closing a parent makes descendant controls unfocusable using the kit's `inert` behavior (or unmounting); never rely on `aria-hidden` alone. Keep focus on the parent trigger and avoid repeated live-region announcements for every ancestor. Existing message/progress live regions remain responsible for dynamic feedback.

Use logical inline-start indentation and inherited `dir`. Directional chevrons mirror in RTL; status glyphs do not. Cap additional visual indentation after the third nesting level, including padding applied by nested disclosure bodies; do not cap semantic depth or hide descendants. Use `min-width: 0`, wrapping content and locally scrollable code so the page does not overflow at 360px. Keep the repository's `mobile`/`desktop` breakpoints and 44px mobile interaction targets, without importing app breakpoint hooks into a library. Verify at 360, 900, 1280 and 1920px with automated layout checks where a real browser harness is available; DOM-only tests must not claim to prove rendered width.

Loading: unresolved stages retain spinners while streaming. Empty: an empty stage array renders nothing; a leaf without content stays a static row. Failure: explicit failures keep their existing icons and summary count. Malformed relation: show the affected stage at the root without a new error banner. Existing theme props cascade through all levels; any new text fallback meets the repository's 7:1 contrast requirement.

### 7. Keep host concerns at the existing app edge

`ConversationMessageItem` supplies `stages`, `isStreaming`, translated `labels`, and `onAttachmentClick`; the existing attachment handler retains preview/download/routing responsibility. Pure stage mapping in `chat-hooks` introduces no SDK/client configuration or per-host business policy. The tree and renderers know only `Stage` and supplied callbacks/styles.

The app currently passes only executed/step labels. Supply existing label slots for nested content and attempts using translation-key enum entries and these English keys: `conversation.stages.running` ("Running"), `.failed` ("Failed"), `.failedCount` ("{{count}} failed"), `.attempt` ("Attempt {{number}}"), `.copyContent` ("Copy stage content"), and `.previewAttachment` ("Preview search result"). Existing `.executed` and `.step` plural keys remain. No i18n library imports in UI libs; their existing English label defaults stay available to standalone hosts.

No feature flag (`ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`), additional telemetry, or cache is introduced. `useMemo` depends on the stage-array reference; it is a render optimization, not a persistence cache with a TTL. No new route, authentication scope, role or global provider.

## Risks / Trade-offs

- **Only implementing the tree would leave history broken** → normalize index-free arrays in the actual app render path and cover indexed and unindexed reload fixtures.
- **Assuming all DTO entrypoints validate equally** → test nested message validation separately from opaque whole-conversation save; do not strengthen the latter in this feature.
- **Retry grouping can remount a stage** → retain local state by stage identity and test the single-attempt to repeated-group transition.
- **Deep nesting can consume width or rendering work** → O(n) forest construction, capped cumulative indentation, collapsed descendants, and a many-level regression fixture; no arbitrary semantic depth cutoff.
- **Duration-only parent and child metadata may overlap** → retain the existing fallback, document it, and leave any new timing interpretation to a separate requirement.
- **Current main spec calls the panel flat and mentions frontend save** → explicit delta requirements replace those assumptions; unrelated dependency-metadata drift in that spec is outside this change.
- **Some embedding consumers receive overlay protocol stages** → that protocol remains flat in this change. The embedded Chat UI and direct `StagesPanel` consumers still gain nesting from normal message data; extending outbound overlay messages is separate work.

## Migration Plan

1. Deliver the optional models/DTO and generation checks, plus normalization and preservation tests.
2. Add the derived hierarchy and sibling grouping with component coverage; wire normalized data and translated labels at the app edge.
3. Update affected library READMEs, validate docs, and run the slice/final verification recorded in tasks.
4. Deploy the additive backend allowance before or together with the frontend if releases are separate. No data rewrite is needed.

Rollback only the renderer/normalizer wiring if needed, retaining the optional DTO field so metadata produced by deployed clients remains accepted. Flat rendering remains the upstream-compatible fallback.

## Open Questions

No product decision blocks implementation. The disclosed-parent UX, sibling grouping and local state ownership were confirmed. The SDK commit is the contract source, not a claim that the repository's installed SDK already includes it; upgrading the SDK is unnecessary for this local DTO/renderer work. UI-kit MCP signature confirmation and real-browser layout verification are implementation checks, not unresolved feature scope.
