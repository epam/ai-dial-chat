## Context

`findDeploymentByIdOrReference` (`apps/chat/src/utils/deployment-id.ts`) already exists and is used by `ConversationView.tsx`, `CatalogView.tsx`, `CustomAppEditor.tsx`, `AppsEditor.tsx`, `AppPreviewChat.tsx`, `ConversationRoute.tsx`, and `useDeploymentSelectorOverlay.tsx` to resolve a deployment from a value that may be either its `id` or DIAL Core `reference`. `ConversationPanelView.tsx` was missed by that earlier change because it doesn't call `.find()` directly — it pre-builds two `Map<id, T>` lookups (`deploymentIconByModelId`, `deploymentNameByModelId`) once per `deployments` list change, then does `.get(modelId)` per row. A `Map.get` is a strict-equality lookup with no fallback path, so it has the same bug the helper was built to fix, just expressed differently.

## Goals / Non-Goals

**Goals:**
- Conversation history panel rows resolve their icon/tooltip by `id` first, `reference` second — identical behavior to `ConversationView`.
- Remove the temporary debug logging added to `DeploymentsService.listDeployments` while diagnosing this.

**Non-Goals:**
- No new lookup mechanism. Reuse `findDeploymentByIdOrReference` as-is; do not add a new `Map`-based reference index.

## Decisions

1. **Drop the `Map` pre-indexing, call the helper per row instead of pre-building id-only maps.** `conversations` is a `useMemo` over `items.map(...)` already — the `deployments` list is small (tens to low hundreds), so an O(n) `findDeploymentByIdOrReference` call per conversation row is the same complexity class the existing single-item lookups elsewhere in the app already use (e.g. `ConversationView`, `AppPreviewChat`), and avoids maintaining two parallel indexing strategies (id-map here vs. helper everywhere else).
   - *Alternative considered*: keep the `Map` but build a second one keyed by `reference` and check both. Rejected — it duplicates the fallback logic the helper already encodes in one place, and two lookup paths for the same concept is exactly the drift this change is closing.

## Risks / Trade-offs

- [Risk] Per-row `findDeploymentByIdOrReference` call is O(items × deployments) instead of O(items) with pre-built maps. → Mitigation: deployments lists are small (same order of magnitude as other single-item lookup call sites already using this helper); no measured performance concern, and correctness (icon actually resolving) matters more here than micro-optimizing a lookup over a small array.
- No migration/rollback concerns — purely a lookup-logic fix and debug-log removal, no data or contract changes.
