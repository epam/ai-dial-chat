## Context

`UserConfigService` (`apps/chat-api/src/user-config/user-config.service.ts`) owns a single JSON file per user stored in DIAL Core (`bucket` + path). The current schema is flat:

```json
{ "version": 1, "pinnedConversationIds": ["conversations/bucket/gpt-4__chat__uuid"] }
```

File path: `.user-config.json` at the bucket root. The service reads, migrates, and writes this file; the controller exposes `GET /api/v1/user-config` and `PATCH /api/v1/user-config/pins`. The existing spec is `openspec/specs/user-config-api/spec.md`.

Two new product features — per-user toolset installation and per-user deployment installation — require storing their own lists. The flat schema cannot accommodate these without creating naming sprawl. Alongside this, moving the file to `.client_data/` aligns it with DIAL Core's convention for structured client-owned data, separating config from conversation files.

In addition, two legacy installation files may already exist per user in the DIAL Core bucket from a previous implementation that stored toolsets and deployments separately:

- `clientdata/installed_toolsets.json` — plain JSON array of toolset ID strings
- `clientdata/installed_deployments.json` — plain JSON array of deployment ID strings

These files must be folded into the unified v2 config during migration and then deleted.

On the frontend, there is no initialization layer for user config. `ConversationsContext` (`apps/chat/src/context/ConversationsContext.tsx`) already calls `apiPinConversation` directly from `apps/chat/src/server-api/user-config.api.ts`. `DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) carries a `// TODO: move to user config` comment on its localStorage-based selected-deployment key, confirming the intent to centralize user-config state. No feature currently loads `GET /api/v1/user-config` at startup; the data is only used reactively on pin operations.

## Goals / Non-Goals

**Goals:**
- Restructure the stored JSON into a namespaced v2 schema.
- Relocate the config file to `.client_data/.user-config.json`.
- Add `toolsets.installed` and `deployments.installed` arrays.
- Expose PATCH endpoints for toolset and deployment install/uninstall.
- Keep `PATCH /api/v1/user-config/pins` working with the new nested field.
- Provide a migration path from v1 flat files (including the old file path).
- Consolidate legacy `clientdata/installed_toolsets.json` and `clientdata/installed_deployments.json` into the unified config.
- Regenerate `@epam/chat-api-client` so frontend types stay strong.
- Add a frontend `UserConfigContext` that loads user config once per authenticated session.
- Gate dependent features behind the loading state so they never render with stale defaults.
- Keep `pinnedConversationIds` in `UserConfigContext` synchronized with pin/unpin operations.
- Expose `setInstalledToolset` and `setInstalledDeployment` for future toolset/deployment UI.

**Non-Goals:**
- Frontend UI for installing toolsets or deployments.
- Endpoint versioning (no `/api/v2/user-config`).
- Rate limit changes.
- Caching of user config (not introduced here; the service already issues a DIAL Core read per call).

## Decisions

### 1. Nested schema over flat fields

The v2 shape groups fields by concern:

```json
{
  "version": 2,
  "conversations": { "pinnedIds": [] },
  "toolsets":      { "installed": [] },
  "deployments":   { "installed": [] }
}
```

**Why:** Adding a new section in the future (e.g. `preferences`, `shortcuts`) is a non-breaking extension — a new top-level key with its own sub-object. A flat shape forces a new top-level array key for every addition and makes `migrateConfig` increasingly entangled.

**Rejected:** Adding `installedToolsetIds` and `installedDeploymentIds` as top-level keys alongside `pinnedConversationIds` — achieves nothing structurally and re-creates the same flat sprawl in the next iteration.

### 2. In-place version bump with forward migration, no new controller version

`CURRENT_CONFIG_VERSION` increments from `1` to `2`. `migrateConfig` handles:

1. Null / non-object input → default v2 config.
2. v1 object (has `pinnedConversationIds`, no nested `conversations`) → lift `pinnedConversationIds` into `conversations.pinnedIds`, set `toolsets.installed = []`, `deployments.installed = []`, `version = 2`.
3. v2+ object → pass through (with array sanitisation for each field).

**Why:** The migration is purely additive at read time. A rolled-back binary reads a file written by v2 code — it will see unknown keys and fall back gracefully because `migrateConfig` treats any unrecognised shape as a v1 migration candidate. No data is destroyed.

**Rejected:** Splitting into `GET /api/v2/user-config` — adds a new controller file, duplicate module registration, Swagger versioning overhead, and a frontend migration path, for zero benefit since no client contracts are broken in a way that requires parallel support.

### 3. File location: `.client_data/.user-config.json`

The new `CONFIG_PATH` constant in `user-config.service.ts` becomes `'.client_data/.user-config.json'`.

**Migration for missing new path:** On `readConfig`, if the DIAL Core download returns non-ok for the new path, the service falls back to reading the old path `.user-config.json`. If found, it migrates the content to v2, writes it to the new path, and deletes the old path (best-effort; failure is logged, not thrown). If neither path yields data, the default config is returned.

**Why:** Keeps migration transparent to callers. First access after deploy performs the one-time move.

**Rejected:** Keeping the old path and only writing to it — misses the stated requirement to move the file.

### 4. New endpoints follow the existing `PATCH /pins` pattern

```
PATCH /api/v1/user-config/toolsets
PATCH /api/v1/user-config/deployments
```

Both accept `{ id: string, isInstalled: boolean }` validated by `UpdateInstalledDto`. Both return 204. Idempotency: adding an existing ID is a no-op; removing a missing ID is a no-op. This mirrors the `UpdatePinsDto` / `updatePin` pattern exactly.

**Why:** Consistency with the existing API surface; minimal surface area; idempotency avoids race-condition failures.

**Rejected:** `POST /toolsets/:id/install` + `DELETE /toolsets/:id` — introduces path parameters that require `@ApiParam`, adds two handler names per resource, and the action-oriented path style diverges from the existing patch-based pattern.

### 5. `UserConfigService` methods follow the existing `updatePin` signature pattern

New methods:
- `updateInstalledToolset(id, isInstalled, token, bucket): Promise<void>`
- `updateInstalledDeployment(id, isInstalled, token, bucket): Promise<void>`

Both delegate to a shared private helper `updateInstalledEntry(section, id, isInstalled, token, bucket)` that reads the config, mutates the target array, and writes back.

**Why:** Avoids duplicating read-modify-write logic for each new section. The private helper is typed to the known section keys.

### 6. `UpdateInstalledDto` — `@IsString` + `@IsNotEmpty` + `@Matches` on `id`

The `id` field represents a DIAL Core resource identifier. Apply `@Matches(/^[\w\-./@]+$/, { message: '...' })` to reject path-traversal characters.

**Why:** Follows the security mandate in `apps/chat-api/AGENTS.md §5` — string inputs that identify resources must be validated with an allowlist regex.

### 7. `getPinnedIds` and `migratePin` updated to `conversations.pinnedIds`

`getPinnedIds` reads `config.conversations.pinnedIds`. `migratePin` operates on the same field. Both call sites that already exist (`ConversationService`) continue to work without change because the method signatures are unchanged.

### 8. Legacy installation file consolidation strategy

After the user-config file is resolved (whether freshly read or migrated from the old path), `readConfig` attempts to read both legacy installation files from the bucket:

1. Download `clientdata/installed_toolsets.json`. If ok: parse as `string[]`. Merge into `config.toolsets.installed` by **new-config-wins union**: start with the existing `config.toolsets.installed` array as the base, then append any IDs from the legacy file that are not already present. Delete the legacy file best-effort. If parse fails (invalid JSON, non-array body, or non-string entries), log `logger.warn` and skip.
2. Repeat identically for `clientdata/installed_deployments.json` → `config.deployments.installed`.
3. If either merge produced any new IDs, call `writeConfig` to persist the merged result.
4. All other config sections (`conversations`, unrelated future sections) are passed through unchanged.

**Why new-config-wins union over full replace:** The new config may already contain IDs installed via the new API endpoint after deploy. Replacing would discard those. New-config-wins union preserves existing state and only appends genuinely new IDs from the legacy file, with no duplicates.

**Why new-config-wins is idempotent:** If the legacy file delete fails and the same IDs are merged again on the next `readConfig`, those IDs are already present in the new config — the "not already present" check produces an empty addition and `writeConfig` is skipped. No duplicates are ever introduced.

**Why `clientdata/` not `.client_data/` for legacy paths:** The legacy files follow the older bucket path convention without the leading dot. The new unified config uses `.client_data/` (dot-prefixed) per DIAL Core convention. Both conventions are valid bucket paths; this service reads from both but only writes to the dot-prefixed convention.

**Rejected:** Running the legacy file consolidation as a one-time background job at startup — complicates startup sequence, requires coordination across multiple pod instances, and offers no benefit over lazy per-user migration at `readConfig` time.

---

## Frontend: User-Config Initialization

### 9. New `UserConfigContext` — single frontend owner of user-config state

File: `apps/chat/src/context/UserConfigContext.tsx`. Follows the `ThemeContext` pattern (`apps/chat/src/context/ThemeContext.tsx`).

**`UserConfigStatus` enum** (`apps/chat/src/types/user-config-status.ts`):

```typescript
enum UserConfigStatus {
  Idle    = 'idle',
  Loading = 'loading',
  Ready   = 'ready',
  Error   = 'error',
}
```

**Context type:**

```typescript
interface UserConfigContextType {
  /** Conversation IDs the authenticated user has pinned. Empty array until Ready. */
  pinnedConversationIds: string[];
  /** Toolset IDs the authenticated user has installed. Empty array until Ready. */
  installedToolsetIds: string[];
  /** Deployment IDs the authenticated user has installed. Empty array until Ready. */
  installedDeploymentIds: string[];
  /** Initialization status of the user-config load. */
  status: UserConfigStatus;
  /** Toggle the pinned state of a conversation. Optimistic update; reverts and rethrows on failure. */
  setPinnedConversation: (id: string, isPinned: boolean) => Promise<void>;
  /** Toggle the installed state of a toolset. Optimistic update; reverts and rethrows on failure. */
  setInstalledToolset: (id: string, isInstalled: boolean) => Promise<void>;
  /** Toggle the installed state of a deployment. Optimistic update; reverts and rethrows on failure. */
  setInstalledDeployment: (id: string, isInstalled: boolean) => Promise<void>;
}
```

**Initialization** (`useEffect`, runs once on mount):
- Sets `status = Loading`
- Calls `getUserConfig()` from `apps/chat/src/server-api/user-config.api.ts`
- Normalizes missing or `null` sections to empty arrays (e.g. `config.conversations?.pinnedIds ?? []`)
- On success: populates state arrays and sets `status = Ready`
- On failure: logs via `console.error`, calls `showNotification({ variant: 'error', message: t(UserConfigI18nKeys.LoadError) })`, sets `status = Error` with empty-array fallback so the app remains usable
- Uses `{ isCancelled: boolean }` cancellation guard matching the `useFavicon` / `ConversationsContext` pattern

**Consumer hook:**

```typescript
const useUserConfig = (): UserConfigContextType => {
  const ctx = useContext(UserConfigContext);
  if (!ctx) throw new Error('useUserConfig must be used inside UserConfigProvider');
  return ctx;
};
```

**Why:** Centralizes all user-config loading and mutation in one context. Individual feature components do not fetch user config independently, preventing duplicate `GET /api/v1/user-config` requests. The `createContext<T | undefined>(undefined)` + guard-hook pattern is the established project convention (`ThemeContext.tsx:31`, `apps/chat/src/context/auth/UserContext.tsx`).

**Why `UserConfigStatus` as an enum in a separate file:** Enum values are reused in tests and in `UserConfigProvider`'s rendering logic. Placing it alongside `StorageKey` in `apps/chat/src/types/` follows the established convention for frontend type enums.

### 10. Loading gate — `UserConfigProvider` blocks children during loading

While `status === UserConfigStatus.Loading`, `UserConfigProvider` renders `<DialSpinner />` instead of `children`. Once `status` is `Ready` or `Error`, it renders `children` inside the context provider.

```tsx
// inside UserConfigProvider render
if (status === UserConfigStatus.Loading) {
  return <DialSpinner />;
}
return (
  <UserConfigContext.Provider value={value}>
    {children}
  </UserConfigContext.Provider>
);
```

**Placement in `apps/chat/src/main.tsx`**: `UserConfigProvider` is placed inside `RequireAuth`, wrapping `AppConfigProvider` and `ConversationsProvider`:

```tsx
<RequireAuth>
  <UserConfigProvider>
    <AppConfigProvider>
      <ConversationsProvider>
        <App />
      </ConversationsProvider>
    </AppConfigProvider>
  </UserConfigProvider>
</RequireAuth>
```

**Why:** `RequireAuth` already shows `<DialSpinner />` during user-profile loading; reusing the same component for user-config loading is visually consistent and requires no new UI surface. Placing `UserConfigProvider` inside `RequireAuth` guarantees it only initializes for authenticated users. Placing it outside `ConversationsProvider` and `AppConfigProvider` ensures neither renders until the config is available — satisfying the requirement that dependent features never render with incorrect default values.

**Why gate on `Loading` only, not `Error`:** On failure the app falls back to empty arrays and remains usable. Blocking the UI on error would be worse than showing an empty-array state with an error notification. `Error` status is surfaced to consumers through `status` so future features can branch on it if needed.

**Mobile / desktop loading state:** `<DialSpinner />` from `@epam/ai-dial-ui-kit` is a self-centering component with no direction-sensitive layout. It renders identically on mobile and desktop without additional responsive work.

### 11. Pin synchronization — `ConversationsContext` routes through `UserConfigContext`

`ConversationsContext.pinConversation` (`apps/chat/src/context/ConversationsContext.tsx`) currently calls `apiPinConversation` directly. After this change it calls `useUserConfig().setPinnedConversation(id, isPinned)` instead.

`UserConfigContext.setPinnedConversation`:
1. Snapshots current `pinnedConversationIds`
2. Optimistically applies the new state (add or remove `id`, deduplicated)
3. Calls `apiPinConversation(id, isPinned)` from `apps/chat/src/server-api/user-config.api.ts`
4. On failure: restores the snapshot and rethrows so `ConversationsContext.pinConversation` can revert its optimistic `isPinned` flag on the conversation item

`ConversationsContext.pinConversation` catches the rethrown error and reverts the conversation list state, matching current behaviour.

**Why:** Ensures `pinnedConversationIds` in `UserConfigContext` is the single source of truth for the API call and stays in sync with the conversation list `isPinned` flag. Routing through `UserConfigContext` eliminates the risk of the two states diverging on concurrent pin operations.

**Why `ConversationsContext` may depend on `UserConfigContext`:** `UserConfigProvider` is an ancestor of `ConversationsProvider` in the component tree, so `useUserConfig()` is always available inside `ConversationsProvider`. The dependency direction is one-way (ConversationsContext → UserConfigContext); `UserConfigContext` has no knowledge of conversations.

**Rejected:** Keeping `apiPinConversation` in `ConversationsContext` and adding a separate `syncPin` notification to `UserConfigContext` — adds a second notification layer, introduces a window where the two states are inconsistent, and requires `ConversationsContext` to know about both the API call and the notification, violating single responsibility.

### 12. Toolset and deployment install/uninstall mutation methods

`UserConfigContext` exposes `setInstalledToolset(id, isInstalled)` and `setInstalledDeployment(id, isInstalled)` following the same optimistic-update + revert-on-failure pattern as `setPinnedConversation`. Both call their respective server-api wrappers (`updateInstalledToolset`, `updateInstalledDeployment`) from `apps/chat/src/server-api/user-config.api.ts`.

These methods are not called by any existing component in this change — they are exposed so future toolset / deployment management UI can consume them without modifying `UserConfigContext`.

### 13. Error handling — toast notification + empty-array fallback

On `getUserConfig()` failure inside `UserConfigProvider`:
- `console.error('[UserConfigContext] Failed to load user config', err)` for diagnostic traces
- `showNotification({ variant: 'error', message: t(UserConfigI18nKeys.LoadError) })` via `useNotification()`
- State falls back to `{ pinnedConversationIds: [], installedToolsetIds: [], installedDeploymentIds: [] }`
- `status` is set to `UserConfigStatus.Error`

`NotificationProvider` is an ancestor of `UserProvider` in `main.tsx`, so it is always available inside `UserConfigProvider`.

**Why empty-array fallback over blocking error screen:** An empty pinned list and empty installed lists are safe defaults — the user loses personalization temporarily but can still use the chat. An unrecoverable error screen on config load failure would block the entire application for a transient network error.

### 14. i18n — one new error key

New enum entry in `apps/chat/src/constants/translation-keys.ts`:

```typescript
export enum UserConfigI18nKeys {
  LoadError = 'userConfig.loadError',
}
```

New entry in `apps/chat/src/i18n/locales/en.json`:
```json
"userConfig": {
  "loadError": "Failed to load your settings. Some personalization may be unavailable."
}
```

No other user-visible strings are introduced by this change.

### 15. No RTL impact

`UserConfigContext` and `UserConfigProvider` add no directional UI surfaces. `<DialSpinner />` is symmetric and direction-agnostic. No Tailwind physical-direction classes or directional icons are introduced.

### 16. No feature flag

User-config initialization is not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. It is a core infrastructure concern that loads for all authenticated users regardless of feature flags.

---

## Risks / Trade-offs

- **Old file leftover after migration** → If the delete-old-file step fails (DIAL Core 4xx/5xx), the old `.user-config.json` stays in the bucket alongside the new path. On next read the new path will be found and the old file ignored — no data corruption. A `logger.warn` records the cleanup failure.
- **Legacy installation file leftover** → If deletion of `clientdata/installed_toolsets.json` or `clientdata/installed_deployments.json` fails, they survive into the next `readConfig` call. The new-config-wins union re-merges the same IDs but the "not already present" check is a no-op — no duplicates are produced and `writeConfig` is skipped. Safe to repeat indefinitely.
- **Concurrent write race (pin + toolset simultaneously)** → Both operations are read-modify-write. A lost update can occur if two requests modify the same config concurrently. This is pre-existing behaviour (the current `updatePin` has the same gap). Mitigation: DIAL Core files API does not provide compare-and-swap; the existing design accepts last-write-wins semantics. No change here.
- **v2 file read by a rolled-back binary** → `migrateConfig` on a v1 binary receives a v2 object. Since it reads `obj['pinnedConversationIds']` which will be `undefined` in a v2 file, it will return `{ version: 1, pinnedConversationIds: [] }` — pins are lost until the service is redeployed forward again. **Mitigation:** document this in the PR and coordinate deploy/rollback with awareness of the data loss window.
- **Frontend user-config fetch failure blocks no features** → The empty-array fallback means conversations render without `isPinned = true` even if the user had pinned items. This is a temporary degraded state that resolves on next page load once the backend recovers. Acceptable trade-off versus blocking the entire application.
- **Pin optimistic-update revert chain** → `UserConfigContext.setPinnedConversation` reverts and rethrows; `ConversationsContext.pinConversation` catches and reverts the conversation list. Two reverts in sequence, each only touching their own state. The chain is linear and has no shared mutable state so no race condition exists.

## Migration Plan

1. Deploy new binary.
2. First `readConfig` call per user performs all migration steps in order:
   a. Reads `.client_data/.user-config.json`. If not found, reads `.user-config.json`. If found, migrates to v2, writes new path, deletes old path (best-effort).
   b. Reads `clientdata/installed_toolsets.json`. If found and valid, appends new IDs into `toolsets.installed`, deletes legacy file (best-effort).
   c. Reads `clientdata/installed_deployments.json`. If found and valid, appends new IDs into `deployments.installed`, deletes legacy file (best-effort).
   d. If any merges occurred in steps b–c, writes the merged config to `.client_data/.user-config.json`.
3. Subsequent calls read from `.client_data/.user-config.json` directly; legacy files are absent so no merge occurs.
4. Rollback: redeploy old binary. It will read `.client_data/.user-config.json` (non-existent keys ignored), fall back to default config. Pins are temporarily lost for users whose config was migrated. If rollback is needed within minutes of deploy, old `.user-config.json` may still exist and the v1 binary will read it.

## Open Questions

- **Toolset and deployment ID format**: The regex `^[\w\-./@]+$` is modelled on DIAL Core resource URL patterns. Confirm the actual format of toolset / deployment IDs with the product team before finalising the `@Matches` constraint in `UpdateInstalledDto`.
- **Delete-old-file API**: Confirm `client.deleteFile(bucket, path, headers)` is available in `@epam/ai-dial-typescript-sdk` before implementing the old-path cleanup. If not, the old file is left in place (acceptable — it is simply orphaned).
