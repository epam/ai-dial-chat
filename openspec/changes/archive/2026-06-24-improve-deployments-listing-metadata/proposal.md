## Why

The existing `GET /api/v1/deployments` response lacks three fields that UI surfaces need to render ownership context, personalised "My deployments" views, and folder-aware navigation for custom applications: the deployment owner, a per-user `isMy` flag, and the application folder path. These fields are partially available in the DIAL Core SDK response but are not forwarded to clients.

## What Changes

- Add `owner?: string` to `DeploymentItemDto` — sourced from `DeploymentBase.owner` already returned by DIAL Core `getDeploymentsByInterfaceType`.
- Add `isMy?: boolean` to `DeploymentItemDto` — computed at the BFF layer by comparing `owner` against the current session identity; keeps ownership logic out of the frontend and out of shared libs.
- Add `applicationFolder?: string` to `DeploymentItemDto` — applicable to `type === 'application'` items only; derived by parsing the application path in the deployment `id` and extracting the parent directory portion; `undefined` for root-level or non-application deployments.
- Extend `RawDeploymentDto` to include the `owner` field.
- Update Swagger annotations on `DeploymentItemDto` and regenerate `@epam/chat-api-client`.
- Update `apps/chat/src/server-api/deployments.api.ts` — no call-site changes required; the enriched fields flow through the existing `listDeployments` method.
- Cache key and TTL remain unchanged; `isMy` is user-scoped and the existing per-user cache key `deployments:list:<userSub>` is sufficient.
- All new fields are **additive and optional** — no breaking change to existing consumers.

## Capabilities

### New Capabilities

- `deployments-owner-field`: Expose the `owner` string from DIAL Core's `DeploymentBase` in the deployments listing response DTO.
- `deployments-is-my-flag`: Compute and expose an `isMy` boolean flag on each deployment item, resolved at the BFF (NestJS) layer by comparing the deployment `owner` against the session user identity.
- `deployments-application-folder`: Derive and expose `applicationFolder` for application-type deployment items, extracted from the deployment `id` path structure.

### Modified Capabilities

- `deployments-api`: The `DeploymentItemDto` shape requirement gains three new optional fields (`owner`, `isMy`, `applicationFolder`). The mapping logic and cache behaviour are updated but backward-compatible.

## Impact

**Backend (`apps/chat-api`)**
- `apps/chat-api/src/deployments/dto/raw-deployment.dto.ts` — add `owner?: string` (line 1–16 today).
- `apps/chat-api/src/deployments/dto/deployment-item.dto.ts` — add three `@ApiPropertyOptional` fields (lines 3–79 today).
- `apps/chat-api/src/deployments/deployments.service.ts` — update `mapToDeploymentItem` (lines 33–84) and `listDeployments` (lines 107–188) to pass `userSub`/`owner` for `isMy` computation and to derive `applicationFolder`.

**Generated client (`libs/chat-api-client`)**
- `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/` — regenerated after DTO annotation update; no hand edits.
- The generated `DeploymentItemDto` TypeScript interface gains three optional fields; no existing call-site breaks.

**Frontend (`apps/chat`)**
- `apps/chat/src/server-api/deployments.api.ts` (lines 1–14) — no changes required; new fields are passed through automatically.
- `apps/chat/src/context/DeploymentsContext.tsx` (lines 80–226) — no required changes; consumers access the enriched DTO transparently.
- Future UI surfaces (catalog filtering, ownership badge, folder breadcrumb) can consume `owner`, `isMy`, and `applicationFolder` without further backend work.

**i18n** — no new user-visible strings introduced by this change; the new fields are data, not labels.

**RTL** — no UI changes in this change; RTL impact is deferred to UI surfaces that consume the new fields.

**Tests**
- `apps/chat-api/src/deployments/tests/deployments.service.spec.ts` — extend existing mapping and `isInstalled` tests.
- `apps/chat-api/src/deployments/tests/deployments.controller.integration.spec.ts` — verify new fields appear in the 200 response.

---

## Non-Goals

- No new endpoint or route version is introduced; `GET /api/v1/deployments` is extended in-place.
- No UI changes are part of this change (catalog filtering, ownership badge, folder breadcrumb are deferred).
- No i18n key additions.
- No feature-flag gating — the new fields are metadata enrichment, not a user-facing capability toggle.
- This change does not alter how `isInstalled` is resolved or how `isFeatured`/`isHidden` are applied.
- This change does not add owner or folder metadata to the separate `GET /api/v1/deployments/:deployment/configuration` endpoint.

## Acceptance Criteria

1. `GET /api/v1/deployments` returns `owner?: string` on each item where DIAL Core provides it.
2. `GET /api/v1/deployments` returns `isMy: true` for items whose `owner` matches the current session user identity; `isMy: false` (or absent) otherwise.
3. `GET /api/v1/deployments` returns `applicationFolder?: string` for `type === 'application'` items that reside inside a sub-folder (i.e., `id` contains at least one `/`); the field is absent for root-level or non-application items.
4. Existing fields (`id`, `displayName`, `type`, `iconUrl`, `description`, `interfaces`, `isFeatured`, `isHidden`, `updatedAt`, `applicationTypeSchemaId`, `inputAttachmentTypes`, `topics`, `maxInputAttachments`, `isInstalled`) are unchanged.
5. `npm run openapi && npm run openapi:check` pass cleanly after the DTO update.
6. `npm exec nx build chat-api-client && npm exec nx lint chat-api-client` pass.
7. All existing backend unit and integration tests continue to pass.
8. New unit tests cover: `owner` field mapping, `isMy` true/false/absent cases, `applicationFolder` derivation (nested, root-level, non-application).

## Alternatives Considered

- **Compute `isMy` on the frontend** — rejected: the session `sub`/bucket identity and the DIAL Core `owner` format are BFF-owned integration details; pushing that comparison into the frontend or a shared lib would violate library isolation rules and leak backend identity semantics into UI code.
- **Expose `applicationPath` (full path) instead of `applicationFolder`** — the `id` field already carries the full path for user-created applications; exposing it again as `applicationPath` would be redundant. `applicationFolder` (the parent directory portion) is the non-redundant, derived value that clients actually need for folder-aware display. If the full path is needed, clients can reconstruct it from `id`.
- **Add a new `v2` endpoint** — rejected: all three new fields are additive optional properties; no existing field is removed or type-narrowed, so a version bump is not warranted.
- **Fetch owner from a separate DIAL Core call** — rejected: `DeploymentBase.owner` is already present in the `getDeploymentsByInterfaceType` response; no additional network call is needed.

## Rollback / Backward Compatibility

All three new fields are **optional** in both the DTO and the generated client TypeScript type. Callers that do not read them are unaffected. Rolling back the change requires reverting the DTO fields, re-running `npm run openapi`, and rebuilding the client — a safe, low-risk revert with no data migration.

## Clarifying Questions

> **Q1 — `owner` comparison for `isMy`**: DIAL Core's `DeploymentBase.owner` is documented as "The name of the owner for the deployment." The session object exposes `sub` (OIDC subject), `bucket` (DIAL Core bucket path, e.g. `users/alice@example.com`), and `claims` (arbitrary OIDC claims). It is not yet confirmed whether DIAL Core populates `owner` with the user's `sub`, bucket path, display name, or another claim value.
>
> **Recommended approach**: compare `raw.owner` against `bucket` (the DIAL Core bucket assigned to the session user), as `bucket` most closely mirrors how DIAL Core identifies resource ownership. If this assumption is wrong, a config-driven claim mapping can be introduced in a follow-up.
>
> **Action required**: Confirm with the DIAL Core team (or inspect a live DIAL Core response) which session field `owner` matches before implementation.

> **Q2 — `isMy` for models and toolsets**: Models and toolsets also carry `owner` in the SDK schema (`ToolsetOpenAi.owner` at SDK line 2073–2074). Should `isMy` be set for all deployment types, or only for `type === 'application'`?
>
> **Recommended approach**: compute `isMy` for all deployment types where `owner` is present. This is consistent and lets the UI reason about ownership regardless of type without adding conditional logic.

> **Q3 — `applicationFolder` for non-user-created applications**: System/admin-deployed applications may have simple `id` values like `my-gpt4-app` with no `/` separator. In that case `applicationFolder` would be absent (undefined), which is correct. Confirm whether any admin-deployed application IDs can contain `/` segments that should NOT be interpreted as a folder path.
