## Context

`toolsets.service.ts` currently returns most fields straight from the DIAL Core SDK response (snake_case) and only computes four ownership flags, also in snake_case, in `enrichToolsetWithOwnership`. `DialToolsetDto`/`DialToolsetAuthSettingsDto` in `openapi-response.dto.ts` mirror that snake_case shape 1:1, so the Swagger contract, the generated `chat-api-client`, and the raw wire response are all snake_case together.

`deployments.service.ts` solves the same DIAL Core snake_case problem differently: `mapToDeploymentItem` reads every raw field explicitly and constructs a fully camelCase `DeploymentItemDto` object literal, with no reliance on `class-transformer` or `@Expose` decorators — just field-by-field remapping. The frontend never has to normalize `/api/v1/deployments` responses.

Today the frontend compensates for the toolsets endpoint's snake_case output with a bespoke normalization layer in `apps/chat/src/server-api/toolsets.ts` (`normalizeToolset`, `normalizeFeatures`, `normalizeAuthSettings`, and three `Raw*` types). This duplicates knowledge of the wire format in a place where the frontend should only know about the app-level camelCase shape (`server-api/` wrappers are meant to be thin).

`deployments.service.ts` separately has `buildToolsetDetails`/`mapToolsetAuthSettings`, which builds `DeploymentDetailsDto.toolsetDetails` (used by `/api/v1/deployments/{id}`) directly from raw DIAL Core snake_case into an already-camelCase `ToolsetAuthSettingsDto`. That code path is independent of `DialToolsetDto` and already follows the target convention — it needs no change.

`DialToolsetDto.features` is typed as `DialModelFeaturesDto`, which is itself snake_case (`truncate_prompt`, `system_prompt`, ...) and is also the response type of `DialModelDto.features` for `GET /api/v1/models`/`GET /api/v1/models/{modelName}`. `models.service.ts` casts the raw DIAL Core response straight to `DialModelDto` with zero field mapping — that endpoint is intentionally raw passthrough today and is out of scope here. `DialModelFeaturesDto` therefore cannot be renamed in place without silently changing the models endpoint's response shape. A new `DialToolsetFeaturesDto` (camelCase, same field set) is introduced for toolsets instead, mapped the same way `deployments.service.ts`'s `mapDeploymentFeatures` maps model/deployment features from raw snake_case.

## Goals / Non-Goals

**Goals:**
- Make `GET /api/v1/toolsets` and `GET /api/v1/toolsets/{toolsetName}` return fully camelCase JSON, with no exception for DIAL-SDK-sourced passthrough fields — matching `/api/v1/deployments`.
- Remove the frontend normalization layer in `apps/chat/src/server-api/toolsets.ts` now that the backend owns the wire-format translation.
- Keep the mapping approach consistent with the established `deployments.service.ts` pattern (manual field-by-field object construction), not a new mechanism (e.g. no `class-transformer`/`@Expose` introduced for this).

**Non-Goals:**
- Changing `/api/v1/deployments` or `DeploymentDetailsDto.toolsetDetails` — already camelCase, out of scope.
- Changing the *request* body DTOs (`toolset-body.dto.ts`, `toolset-auth.dto.ts`) — already camelCase, unaffected.
- Adding backward-compatible dual-format (`is_installed` AND `isInstalled`) output. This is a breaking, versioned-endpoint change; DIAL Chat's own frontend is the only consumer we know of, and it moves in the same change.
- Deduplicating `mapToolsetAuthSettings` (deployments.service.ts) and the new toolsets-side auth-settings mapper — they serve two different DTOs (`ToolsetAuthSettingsDto` vs `DialToolsetAuthSettingsDto`) with different field sets (e.g. `appLevelAuthStatus` only exists in the deployments-details variant). Sharing one helper across two distinct response shapes would add coupling for no reuse benefit; left as a possible future cleanup, not part of this change.

## Decisions

**Decision: Manual field-by-field remap in `toolsets.service.ts`, not a shared generic transformer.**
Mirrors `mapToDeploymentItem`'s established pattern in this codebase. Alternative considered: a generic `snakeToCamelObject()` deep-key-transform utility applied to the whole response. Rejected because (a) it would silently camelCase unexpected/future DIAL Core fields with no Swagger/DTO visibility into what changed, (b) `nestjs-best-practices.md` requires DTOs with explicit `@ApiProperty` metadata per field, which a generic transform can't produce, and (c) `auth_settings` needs the same client-secret/code-verifier redaction it gets today (`redactAuthSettingsSecrets`) — an explicit mapper keeps that redaction colocated with the field list instead of relying on a denylist applied after a blind transform.

**Decision: Rename `DialToolsetDto`/`DialToolsetAuthSettingsDto` fields in place, not introduce new `DialToolsetV2Dto`.**
The endpoints are already URI-versioned at `/api/v1/toolsets`; a field-rename is exactly the kind of change a major version bump exists for, but this repo's convention (confirmed by the `deployments` precedent, which itself changed shape without a `v2`) is to fix response DTOs in place rather than fork a new DTO per field-naming fix. Introducing `DialToolsetV2Dto` would require a second controller version, a second frontend adapter, and a deprecation window we have no product requirement for — the only known consumer is this repo's own frontend, updated in the same change.

**Decision: Introduce `DialToolsetFeaturesDto` rather than renaming the shared `DialModelFeaturesDto` in place.**
Alternative considered: rename `DialModelFeaturesDto`'s fields to camelCase directly, since it's only referenced from two DTOs. Rejected because `DialModelDto` (the other consumer, `GET /api/v1/models`) is deliberately raw-passthrough today (`models.service.ts` never maps DIAL Core's response) — renaming the shared DTO would silently change that unrelated, out-of-scope endpoint's wire format with no corresponding service-layer change to actually produce camelCase data, breaking it. A toolset-specific DTO keeps the two endpoints' evolution independent, matching the `mapToolsetAuthSettings` non-goal above.

**Decision: Delete the frontend normalizer rather than keep it as a no-op safety net.**
Alternative: leave `normalizeToolset` in place but change its snake_case branch to be unreachable dead code, in case some other DIAL Core deployment variant still emits snake_case. Rejected — the normalizer's `rest.foo ?? raw_foo` fallback pattern exists specifically to bridge the mismatch this change eliminates; keeping unreachable fallback branches contradicts the repo guidance against dead/speculative code paths, and the BFF is the single point of truth for this response shape (the frontend never talks to DIAL Core directly).

## Risks / Trade-offs

- **[Risk] Breaking change for any out-of-repo consumer of `GET /api/v1/toolsets`** → Mitigation: this is a first-class, intentionally breaking response-shape fix (same category as the `deployments` precedent); documented as **BREAKING** in the proposal. No known external consumers exist today — the only consumer is this repo's frontend, updated in the same change.
- **[Risk] Generated `chat-api-client` regeneration could silently pick up unrelated upstream OpenAPI drift** → Mitigation: run `npm run openapi:check` before rebuilding, and scope the diff review to the toolsets-related model/API files.
- **[Risk] Missed snake_case field left un-mapped in `toolsets.service.ts`, causing an `undefined` in the response** → Mitigation: field list is enumerated exhaustively in the proposal from `DialToolsetDto`/`DialToolsetAuthSettingsDto`'s current property list; `toolsets.service.spec.ts` assertions (rewritten to camelCase) act as the regression check for every field.

## Migration Plan

1. Rename fields on `DialToolsetDto`/`DialToolsetAuthSettingsDto` (`openapi-response.dto.ts`).
2. Rewrite `toolsets.service.ts`'s mapping helpers (`withDisplayName`, `redactToolsetSecrets`, `enrichToolsetWithOwnership`, and the raw-DIAL-Core read sites in `listToolsets`/`getToolset`/`getCustomToolset`) to construct the camelCase shape explicitly, reading off the raw snake_case DIAL Core payload.
3. Update `toolsets.service.spec.ts` fixtures/assertions to camelCase.
4. Run `npm run openapi && npm run openapi:check`, rebuild/lint `chat-api-client`.
5. Delete `normalizeToolset`/`normalizeFeatures`/`normalizeAuthSettings` and `Raw*` types from `apps/chat/src/server-api/toolsets.ts`; simplify `listToolsets`/`getToolset` to direct passthrough.
6. Update/verify frontend tests that touch the toolsets adapter.
7. Update `openspec/specs/catalog-toolsets/spec.md`.

No feature flag or staged rollout: this is a single-deploy, same-PR change across backend and frontend (both live in this monorepo and ship together), so there is no intermediate state where one side expects the old shape and the other emits the new one. Rollback is a plain revert of the commit/PR.

## Open Questions

None — scope and approach confirmed with the requester (full camelCase parity with `/api/v1/deployments`, single-PR breaking change, no dual-format compatibility layer).
