## Context

The current codebase has two separate persistence concerns:

1. **Operator default**: There is no mechanism for an operator to configure which deployment appears selected for a user who has never made an explicit choice. The first sorted deployment wins by accident.
2. **User preference persistence**: `DeploymentsContext.tsx` writes the user's selected deployment to `localStorage` key `dial:selectedDeploymentId`. This is device-scoped, unshared, and sits outside the existing cross-device user-config store (`.client_data/.user-config.json` in DIAL file storage, accessed via `UserConfigService`).

The backend already has two related systems:
- **Config registry** (`config-registry.constants.ts`, `AppConfigService`, `AppConfigController`): Resolves operator configuration from environment variables and exposes client-visible values via `GET /api/v1/client-config`. Currently exposes `asrModelId` and `transcribeSizeLimitBytes`.
- **User config** (`UserConfigService`, `UserConfigController`): Stores per-user data in DIAL file storage. Currently holds pinned conversations, installed toolsets, and installed deployments (favorites). Version is at v2.

## Goals / Non-Goals

**Goals:**
- Allow operators to set a default deployment via `DEFAULT_DEPLOYMENT` env var, surfaced through the existing client-config endpoint.
- Move user-selected deployment persistence from `localStorage` to user config, providing cross-device sync.
- Define deterministic initial-selection precedence for `DeploymentsContext` that handles all load orderings gracefully.
- Preserve `restoreSelectedItemId` semantics: updates visible selection (for conversation restore) without overwriting the user's new-chat preference.
- Maintain backward compatibility for existing v1/v2 user-config files.

**Non-Goals:**
- No UI changes (no new modal, drawer, or settings screen).
- No migration of historical `localStorage` values to user config (first-load fallback chain handles the transition gracefully).
- No per-deployment role gating or visibility rules.
- No analytics or telemetry for the selected deployment.

## Decisions

### D1 — Store selected deployment in user config, not localStorage

**Decision:** Persist `deployments.selectedId` in `UserConfigDto` (v3) and write it via a new `PATCH /api/v1/user-config/deployments/selected` endpoint.

**Alternative considered:** Keep `localStorage` but also mirror to user config as a secondary write. Rejected because it creates two sources of truth and complicates the precedence logic on load.

**Rationale:** User config is already the authoritative cross-device store for user preferences. Putting selected deployment there is consistent and eliminates divergence between devices.

### D2 — New PATCH endpoint at `/deployments/selected` rather than extending the existing `/deployments` endpoint

**Decision:** Add `PATCH /api/v1/user-config/deployments/selected` with body `{ id: string | null }` rather than reusing `PATCH /api/v1/user-config/deployments`.

**Alternative considered:** Extend the existing endpoint body with an optional `selectedId` field. Rejected because it conflates the install/uninstall boolean operation with the single-selection operation, making both harder to validate cleanly.

**Rationale:** Separate endpoint per concern keeps DTOs minimal and validations clear. The REST sub-resource pattern (`/deployments/selected`) is consistent with how other fine-grained updates are structured in the user-config controller.

### D3 — User-config schema version bump to v3

**Decision:** Increment `CURRENT_CONFIG_VERSION` from 2 to 3. Add a v2→v3 migration step in `migrateConfig` that sets `deployments.selectedId = null` on any config file missing that field.

**Alternative considered:** Leave version at 2 and add `selectedId` as an optional field with no version bump. Rejected because a version bump makes it easier to reason about which clients understand `selectedId` and simplifies future migrations.

**Rationale:** The version bump is low-risk — migration is additive (null default) and existing files remain readable.

### D4 — Initial-selection precedence in DeploymentsContext

**Decision:** On initial load the context SHALL evaluate in order:
1. Current in-memory `selectedItemId` if still valid (deployment still present in new items list).
2. `userConfig.deployments.selectedId` if present in the loaded deployments list.
3. `appConfig.defaultDeploymentId` if present in the loaded deployments list.
4. First sorted deployment (`items[0]?.id`).
5. `null` if no deployments exist.

**Rationale:** In-memory takes priority to avoid flickering during a deployments reload. User config trumps operator default because explicit user choice should not be overridden by operator preference.

### D5 — `restoreSelectedItemId` must not call the user-config API

**Decision:** `restoreSelectedItemId` sets local state only (`setSelectedItemId` internal state, not the persistence write). The `setSelectedItemId` public API is the only path that triggers the backend write.

**Rationale:** When opening an existing conversation, the visible deployment changes to match the conversation's model but this should not overwrite the user's preferred default for *new* chats. This is the original intent of the `restoreSelectedItemId` split (documented in the existing `TODO` in `DeploymentsContext.tsx`).

### D6 — `DeploymentsContext` reads `userConfig` and `appConfig` through context, not direct API calls

**Decision:** `DeploymentsContext` reads `useUserConfig()` and `useAppConfig()` to obtain the stored selected ID and default deployment ID. Both providers already wrap `DeploymentsProvider` in the provider tree.

**Alternative considered:** Load the values via separate `useEffect` calls inside `DeploymentsContext`. Rejected because `UserConfigContext` and `AppConfigContext` already fetch the data; a duplicate fetch would be redundant.

**Rationale:** Consuming existing contexts avoids duplicate fetches and keeps data flow unidirectional.

## Risks / Trade-offs

- **Race between context mounts**: `DeploymentsContext` depends on `UserConfigContext` and `AppConfigContext` being ready. Since `UserConfigProvider` renders a spinner while loading, `DeploymentsProvider` and all children mount after user config is `Ready`, so the race is already eliminated by the existing provider hierarchy.
- **PATCH failure on selection change**: If `PATCH /api/v1/user-config/deployments/selected` fails, the local in-memory selection has already updated. The user sees the correct deployment in the UI but the next session may revert to a stale value. Mitigation: show no error notification (silent fail) for this low-stakes write; log the error at warn level.
- **localStorage removal**: Existing users who have `dial:selectedDeploymentId` in localStorage will land on their user-config `selectedId` (null for new-to-user-config users) → operator default → first sorted deployment on first load after this change. This is intentional and acceptable — selection is not critical data.
- **Version skew during rolling deploy**: If the frontend deploys before the backend (or vice versa), the new PATCH endpoint may not exist for a brief window. Mitigation: the frontend should treat a 404 or 5xx from the PATCH endpoint as a silent fail (same as any other network error in the PATCH path).

## Migration Plan

1. Deploy backend changes first: env validation, config-registry entry, `ClientConfigResponseDto` update, user-config DTO v3, `PATCH /api/v1/user-config/deployments/selected`.
2. Regenerate `@epam/chat-api-client` and update frontend server-api wrappers.
3. Deploy frontend changes: `DeploymentsContext` selection logic, `UserConfigContext` new field/mutation, `AppConfigContext` new field.
4. Remove `localStorage` key `dial:selectedDeploymentId` reads/writes from the frontend (no data migration needed).

**Rollback:** Reverting the frontend to the previous build restores `localStorage`-based persistence with no data loss (localStorage values were never cleared). Backend changes are purely additive and safe to leave deployed.
