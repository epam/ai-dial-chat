## Context

`GET /api/v1/deployments` (`apps/chat-api/src/deployments/deployments.controller.ts:16–55`) already proxies `getDeploymentsByInterfaceType` from the DIAL TypeScript SDK. The SDK's `DeploymentBase` schema (SDK `index.d.ts:1873–1900`) includes `owner?: string` — "The name of the owner for the deployment" — but neither `RawDeploymentDto` (`dto/raw-deployment.dto.ts`) nor the mapping function `mapToDeploymentItem` (`deployments.service.ts:33–84`) forward it. No ownership or folder metadata is present in the current `DeploymentItemDto` (`dto/deployment-item.dto.ts:3–74`).

Frontend context (`apps/chat/src/context/DeploymentsContext.tsx:80–226`) and the server-api wrapper (`apps/chat/src/server-api/deployments.api.ts:7–14`) require no call-site changes; they pass the DTO through transparently.

## Goals / Non-Goals

**Goals**
- Forward `owner` from DIAL Core's raw deployment payload to clients.
- Compute `isMy` in the NestJS BFF layer — the only place that has both the session identity and the DIAL Core owner value together — and expose it as a derived boolean on each item.
- Derive `applicationFolder` from the deployment `id` path structure and expose it as an optional string on application-type items.
- Keep the change backward-compatible: all new fields are optional.

**Non-Goals**
- No new endpoint or version bump.
- No UI components, catalog filters, or ownership badges.
- No changes to `isInstalled`, `isFeatured`, or `isHidden` logic.
- No changes to the `getDeploymentConfiguration` endpoint.
- No i18n keys.

## Decisions

### D1 — `owner` field: pass-through from DIAL Core, no transformation

`DeploymentBase.owner` (SDK line 1886–1887) is available in the raw payload for all deployment types. The field is documented as an opaque string representing the owner name; we forward it verbatim without normalisation.

**Rationale**: Transforming it risks breaking `isMy` comparisons if the format ever changes server-side. Keeping it raw also gives clients (e.g. an admin UI) access to the canonical value.

**Alternative rejected**: Omit `owner` and expose only `isMy` — rejected because `owner` has independent display value (e.g. "Created by: Alice") beyond the boolean comparison.

### D2 — `isMy` computed post-cache using `id` path segments

`isMy` is `true` when `item.id.split('/').includes(bucket)`. The NestJS `listDeployments` method already receives `bucket` (from `req.user.bucket` via `SessionUser`, `session.types.ts:30–38`). `isMy` is overlaid in the post-cache pass alongside `isInstalled`.

**Rationale**: DIAL Core's `owner` field is a human-readable display name (e.g. `"Test User"`), not a machine-comparable identifier — comparing it against `bucket` always produces `false`. For user-created applications, DIAL Core embeds the bucket in the deployment `id`: `applications/{bucket}/{app-name}`. Checking whether the bucket appears as a path segment of `id` reliably identifies ownership for all current deployment types without depending on the `owner` string format.

**Scope**: `isMy` is computed for all deployment types. For system/admin deployments and models whose `id` does not embed a bucket, the result is `false`, which is correct.

**Alternative rejected**: Compare `owner` against `bucket` — `owner` is a display name, not a bucket path; this approach always produces `false` for user-created apps. Compare `owner` against `sub` — `sub` format (e.g. `auth0|...`) is also unrelated to DIAL Core bucket paths.

**Scope note**: `isMy` is computed for all deployment types where `owner` is present, not just `type === 'application'`. Models and toolsets in DIAL Core can also be user-owned, and treating them consistently avoids conditional display logic in the frontend.

### D3 — `applicationFolder` derived from `id` path, absent for non-applications and root-level apps

For `type === 'application'` items, `applicationFolder` is extracted as the parent directory portion of `id` (everything before the last `/`). If `id` contains no `/`, the field is omitted (i.e., the application is at the bucket root).

Example derivations:
| `id`                          | `applicationFolder` |
|-------------------------------|---------------------|
| `my-app`                      | *(absent)*          |
| `folder1/my-app`              | `folder1`           |
| `folder1/folder2/my-app`      | `folder1/folder2`   |

For `type === 'model'` and `type === 'toolset'`, the field is always absent.

**Rationale**: The `id` of a user-created DIAL Core application IS the `application_path` parameter used in DIAL Core's `/v1/applications/{Bucket}/{application_path}` operations (SDK lines 3967–3968). The last path segment is the application name; everything before it is the folder path. This derivation requires no extra network call.

**Alternative rejected**: Expose `applicationPath` (the full `id` value) — redundant with `id` which already carries the full path. Clients would have to parse it themselves; providing the derived `applicationFolder` directly is more ergonomic and avoids repeated parsing on the client.

**Alternative rejected**: Fetch the folder path from a separate DIAL Core metadata API — unnecessary overhead; the information is derivable from `id` without a round-trip.

### D4 — Cache key unchanged; `isMy` is computed post-cache

`isMy` is added **after** the cache is read, in the same pass that adds `isInstalled` (`deployments.service.ts:163–174`). The cached value never includes `isMy` or `isInstalled`; both are overlaid per-request using the session identity. This is already the pattern for `isInstalled` and requires no change to the cache key or TTL.

**Rationale**: Caching `isMy` would tie the cache to a specific user's identity, defeating the intent of per-user caching and creating stale-ownership bugs if the deployment changes hands.

`applicationFolder` IS derived from the immutable `id` field and therefore CAN be included in the cached `DeploymentItemDto[]`. We include it in `mapToDeploymentItem` so it is stored with the rest of the mapping. `owner` is similarly static per deployment and is included in the cached items.

### D5 — `RawDeploymentDto` extended; no changes to other DTOs

`raw-deployment.dto.ts` is a plain TypeScript interface used only inside `apps/chat-api`. Adding `owner?: string` there is sufficient. No changes to `libs/chat-shared` or any lib — this remains entirely within the `apps/chat-api` boundary.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| DIAL Core `owner` format differs from `bucket` → `isMy` always `false` | Clarifying question Q1 in the proposal. Implementation uses a documented, easily-swappable comparison. Flag in tests with a comment noting the assumption. |
| Admin-deployed application `id` values contain `/` unrelated to folder structure → spurious `applicationFolder` | Q3 in the proposal. The field is optional; a `undefined` value is always correct for root-level apps, and a wrong folder value would only affect display. Impact is low. |
| Future DIAL Core schema changes remove or rename `owner` | `owner` on `DeploymentItemDto` is optional; absent values degrade gracefully to `undefined`. `isMy` falls back to `false` when `owner` is absent. |
| `isMy` exposes user-identity comparison logic in the API response | Mitigated by keeping `owner` opaque and using server-side computation — the raw identity comparison never leaves the BFF. |

## Migration Plan

1. Update `RawDeploymentDto` and `DeploymentItemDto` with the three new optional fields.
2. Update `mapToDeploymentItem` and `listDeployments` signatures.
3. Run `npm run openapi && npm run openapi:check`.
4. Rebuild and lint `chat-api-client`.
5. No frontend migration steps — new fields flow through transparently.
6. **Rollback**: revert the DTO changes, re-run `npm run openapi`, rebuild `chat-api-client`. No data migration or state cleanup needed.

## Open Questions

- **Q1 (blocking for `isMy` accuracy)**: Confirm which session field matches the DIAL Core `owner` value for user-created deployments (`bucket` vs `sub` vs a specific OIDC claim). See proposal Clarifying Questions §Q1.
- **Q2 (scope of `isMy`)**: Confirm that `isMy` should be set for models and toolsets as well as applications. See proposal Clarifying Questions §Q2.
- **Q3 (admin app `id` format)**: Confirm whether any admin-deployed application IDs contain `/` separators that should NOT be interpreted as folder paths. See proposal Clarifying Questions §Q3.
