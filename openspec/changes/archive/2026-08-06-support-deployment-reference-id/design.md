## Context

DIAL Core identifies a deployment by `id`, but for some deployment types (observed on models) Core also exposes a `reference` value that can appear in place of `id` elsewhere in the system — specifically in a conversation's stored `model` value and in a message's `model.id`. `RawDeploymentDto` (`apps/chat-api/src/deployments/dto/raw-deployment.dto.ts:16`) already receives `reference` from Core's raw payload; today it is read exactly once, as a fallback key for the `isFeatured` env lookup (`deployments.service.ts:268`), and is otherwise discarded — `DeploymentItemDto` has no `reference` field, so the generated `chat-api-client` and the frontend never see it.

Every frontend lookup that resolves a deployment from a stored id currently does a single `deployments.find((d) => d.id === someId)` (`CatalogView.tsx:587`, `CustomAppEditor.tsx:87`, `AppsEditor.tsx:113`, `ConversationView.tsx:232`, `useAudioTranscription.ts:23`). When `someId` is actually a Core `reference` rather than an `id`, this lookup silently fails (icon/name fall back to "unknown deployment", features like MCP/attachments resolve as unsupported).

## Goals / Non-Goals

**Goals:**

- Make `reference` available on every `DeploymentItemDto` the frontend receives, sourced from DIAL Core.
- Let every frontend deployment-lookup-by-id call site also match on `reference`, so a value that happens to be a `reference` still resolves to the correct deployment.
- Let `Conversation.model` (and any code that reads a message's model id) carry an optional `reference` alongside `id`, without breaking existing storage/serialization of conversations that only have `id`.

**Non-Goals:**

- Changing how conversations are created, persisted, or sent to Core (`deploymentId` on `POST /api/v1/conversations` stays `id`-based per `conversation-deployment-selection` — this change does not add a `reference` input to that endpoint).
- Deciding *why* Core sometimes emits a `reference` in place of an `id` for a given deployment — that's Core-side behavior; this change only makes the frontend resilient to it.
- Backfilling `reference` onto deployment types where Core never sends it (toolsets/applications) — the field stays optional end-to-end.

## Decisions

1. **Propagate, don't compute.** Add `reference?: string` to `DeploymentItemDto` (`deployment-item.dto.ts`) and set it directly from `raw.reference` in `mapToDeploymentItem` (`deployments.service.ts:261-…`), mirroring how every other raw field is passed through. No derivation logic — Core is the sole source of truth for `reference`.
   - *Alternative considered*: compute a synthetic reference client-side (e.g. strip a version suffix from `id`). Rejected — `reference` is an opaque Core-assigned value with no derivable relationship to `id`.

2. **Single shared lookup helper, not five ad-hoc `.find()` edits.** Add `findDeploymentByIdOrReference(deployments: DeploymentItemDto[], idOrReference: string | null | undefined): DeploymentItemDto | undefined` to `apps/chat/src/utils/deployment-id.ts` (already the home for deployment-identity helpers). It checks `d.id === idOrReference` first, then falls back to `d.reference === idOrReference`. All five call sites (`CatalogView`, `CustomAppEditor`, `AppsEditor`, `ConversationView`, `useAudioTranscription`) switch from inline `.find(...)` to this helper.
   - *Alternative considered*: build a `Map` keyed by both `id` and `reference` on `DeploymentsContext` for O(1) lookup. Rejected as premature — deployment lists are small (tens to low hundreds of items) and a linear `.find()` is already the existing pattern at every call site; introducing a second indexed structure adds state-sync surface for no measurable benefit.

3. **`Conversation.model` stays `{ id: string }` — no new field.** The ambiguity lives inside the existing `id` value itself: a stored conversation's `model.id` (and a message's `model.id`) may already hold what is actually Core's `reference` for that deployment, not a separate value living alongside `id`. So there is nothing to widen on `Conversation.model` — every lookup site just needs to pass the single `model.id` value into `findDeploymentByIdOrReference`, which checks it against both `deployment.id` and `deployment.reference`.
   - *Alternative considered (and rejected during implementation)*: add `reference?: string` to `Conversation.model` so `id` and `reference` could be tracked as two distinct fields. Rejected — nothing populates a second field; Core's ambiguity is already fully captured by the existing `id` string, and adding an unused field would violate "every declared field must be read/written for a reason".

## Risks / Trade-offs

- [Risk] A deployment's `reference` could collide with another deployment's `id` in the same list, making the fallback match ambiguous. → Mitigation: `findDeploymentByIdOrReference` only falls back to `reference` when the `id` match fails, and only for the exact incoming string — this mirrors Core's own addressing model where `id`/`reference` collisions are not expected within one list; no additional guard is warranted without evidence Core ever does this.
- [Risk] Missing a call site that matches deployments by `id` outside the five found (`grep`-verified, but new call sites can appear later). → Mitigation: centralizing on `findDeploymentByIdOrReference` means any *future* lookup site that imports it gets the fallback for free; this design doesn't add lint enforcement against new inline `.find((d) => d.id === ...)` since that would be a broader refactor than this change's scope.
- No migration/rollback concerns: the new field and helper are additive; deploying is a single coordinated release (backend DTO + OpenAPI regen + frontend), no data migration needed.
