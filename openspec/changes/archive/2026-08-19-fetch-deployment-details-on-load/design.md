## Context

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) already owns `selectedDeploymentConfiguration`, fetched via `getDeploymentConfiguration` in an effect keyed on `resolvedSelectedDeploymentId` (lines 413-441). `resolvedSelectedDeploymentId` is derived from `selectedItemId`, which is set either by user selection (`setSelectedItemId`, persists to user config) or by `restoreSelectedItemId` when a conversation page loads and restores its last-used model — so this single effect already covers "conversation page opened."

The backend endpoint and frontend client wrapper for deployment details both already exist and are unmodified by this change:
- `GET /api/v1/deployments/{deployment}/details` — `apps/chat-api/src/deployments/deployments.controller.ts:159-191`, spec'd in `openspec/specs/deployment-details-api/spec.md`.
- `getDeploymentDetails(deploymentId): Promise<DeploymentDetailsDto>` — `apps/chat/src/server-api/deployments.ts:12-15`.

Today `getDeploymentDetails` is only called from catalog/editor surfaces (`CatalogView.tsx`, `CustomAppEditor.tsx`, `AppEditorIframe.tsx`), never from the conversation-load path.

## Goals / Non-Goals

**Goals:**
- Fetch deployment details in parallel with deployment configuration whenever `resolvedSelectedDeploymentId` changes (covers conversation-page open, since that's what drives `restoreSelectedItemId` today).
- Store the result in `DeploymentsContext` state and expose it via `DeploymentsContextType`, following the same cancellable-effect / race-safety pattern as `selectedDeploymentConfiguration`.
- Avoid duplicate requests: one fetch per `resolvedSelectedDeploymentId` change, not one per render, and not a second independent effect that could race with the configuration effect's cleanup.

**Non-Goals:**
- Consuming `selectedDeploymentDetails` anywhere (e.g. omitting `temperature` from chat completion payloads). Tracked as a follow-up once real DIAL Core response shapes for models/applications/toolsets have been reviewed.
- Removing or altering the separate deployment-limits request (`useDeploymentUsageLimits` / `getDeploymentLimits`). Tracked as a follow-up investigation into whether `DeploymentDetailsDto` already carries limits data.
- Any backend change — the details endpoint and DTO are already implemented and correct for this purpose.

## Decisions

**Extend the existing configuration effect to also fetch details, in the same effect body, rather than adding a second `useEffect`.**
Both fetches share the identical trigger (`resolvedSelectedDeploymentId`) and identical cancellation semantics. Firing `getDeploymentConfiguration(id)` and `getDeploymentDetails(id)` together via `Promise.allSettled` (not sequential `await`s) inside one effect body guarantees they run concurrently, guarantees exactly one `signal.isCancelled` guard covers both, and avoids a second cleanup closure that could theoretically be torn down out of sync with the first if they were separate effects. `Promise.allSettled` (rather than `Promise.all`) is used so a details failure doesn't clear an already-successful configuration result, and vice versa — each setter is driven by its own settled result.

Alternative considered: a separate `useEffect` for details, deduplicated only by the same dependency array. Rejected — two effects with identical dependencies but independent cancellation flags is exactly the kind of subtly-divergent-lifecycle bug the existing code comment block (lines 175-183) about request sequencing warns against; one effect keeps the two fetches provably in lockstep.

**Add `selectedDeploymentDetails: DeploymentDetailsDto | null` and `isDeploymentDetailsLoading: boolean` to `DeploymentsContextType`, mirroring `selectedDeploymentConfiguration`'s null-on-error/null-on-no-selection behavior.**
Consistency with the existing field means downstream consumers (the temperature and limits follow-ups) get a familiar shape. A separate loading flag (rather than reusing the context's top-level `isLoading`, which represents the initial deployments-list load) avoids overloading a flag that already has a different meaning in the existing spec.

Alternative considered: a new dedicated context/hook (`useDeploymentDetails`) similar to `useDeploymentUsageLimits.ts`. Rejected for this step — the details fetch is keyed on exactly the same id as configuration and belongs in the same provider; a separate hook would need to re-derive `resolvedSelectedDeploymentId` independently or import it from `DeploymentsContext`, adding indirection with no present benefit. This can be revisited once real consumers (temperature/limits follow-ups) show a need to decouple it.

**No change to `restoreSelectedItemId`/`setSelectedItemId`/selection-precedence logic.** This change is purely additive to the configuration-fetch effect.

## Risks / Trade-offs

- **[Risk]** Adding a second network call to the same conversation-load path increases requests-per-model-switch from 1 to 2. → **Mitigation:** `getDeploymentDetails` is already 60s-cached and de-duplicated server-side (`pendingDetailsRequests` map in `deployments-details.service.ts`), so repeated switches back to a recently-viewed deployment are cheap; the two calls run concurrently, not sequentially, so wall-clock latency for configuration (which nothing currently blocks on details) is unaffected.
- **[Risk]** A failing details fetch could be mistaken for a hard error if not isolated from configuration. → **Mitigation:** `Promise.allSettled` plus independent try/catch-equivalent handling per fetch (as decided above) ensures a details failure only nulls `selectedDeploymentDetails`, leaving `selectedDeploymentConfiguration` unaffected.
- **[Trade-off]** `selectedDeploymentDetails` is added to the codebase now with no consumer, which is normally avoided — justified here because it is explicitly requested as a preparation step for two named, scoped follow-ups (temperature handling, limits redundancy check), and unused-export lint rules do not flag context fields that are part of a public context type.
