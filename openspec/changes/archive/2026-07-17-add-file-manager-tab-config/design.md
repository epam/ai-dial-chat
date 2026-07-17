## Context

**Legacy `sourceFilters`/`availableTabs`** (`development:apps/chat/src/components/FileManager/hooks/useFileManager.tsx:174-201`, `development:apps/chat/src/utils/app/search.ts:60-90`):

- `UseFileManagerOptions.availableTabs?: Set<string>`, default `defaultAvailableTabs = new Set([MyFiles, Shared, Organization])` — a **host-supplied React prop**, never sourced from a deployment/config/feature-flag system. No legacy code path fetched this from a server. `getInitialTab(availableTabs)` walked a fixed priority (`MyFiles → Organization → Shared → Review`) to pick a valid initial tab from whatever subset was passed in.
- Tab **membership** (which files appear under which tab) came from `filterFilesByFilters(files, <tab's filter>)` applied to **one shared, already-loaded `files`/`folders` array** (Redux state populated by `FilesActions.getFilesWithFolders`), where each item already carried `sharedWithMe: boolean`, `publishedWithMe: boolean`, `isShared: boolean`, `isPublished: boolean` (`search.ts:60-90`: `SharedWithMeFilter = (item) => !!item.sharedWithMe`, `PublishedWithMeFilter.sectionFilter = (item) => !!item.publishedWithMe`, etc.). The Review tab used a *different* mechanism entirely — `getEntityBucket(f) === reviewBucket` — not a boolean flag.
- The destination-folder popup (`destinationFolderPopupOptions`, built in the same legacy hook) has no reference to `activeTab`/`availableTabs` in its construction — it always operates on whichever tab's tree is already active. Same as the current, already-shipped `file-manager-folder-picker` capability.

**Current architecture** deliberately diverged from this: `file-manager-tabs` (already shipped) fetches each tab from its **own BFF endpoint** (`/files/list` for `my_files`, `/files/shared`, an organization/public listing), each independently cached/invalidated per `useDialFileManager`'s existing per-tab retry-counter model. No file item carries a `sharedWithMe`/`publishedWithMe` flag — tab membership is entirely determined by *which endpoint returned the item*, not by inspecting a flag on it. This is a structural choice already made and shipped across `file-manager-tabs`/`file-manager-sharing`/`file-manager-copy-move`, not something this change should reverse.

**Precedent for file-level provenance flags, found in the current codebase (not legacy)**: `apps/chat-api/src/conversations/conversation.service.ts:655-777` implements the exact merge-and-flag pattern legacy relied on — for conversations. It issues three separate DIAL Core calls (user bucket, public bucket, `getSharedResources`), deduplicates by a bucket-relative path, and stamps `sharedWithMe`/`publishedWithMe` onto the resulting merged list (`ConversationListItemDto.sharedWithMe`/`publishedWithMe`, confirmed present in `libs/chat-api-client/src/generated/src/models/index.ts:584`). This proves the pattern is buildable for files too — it is not blocked by DIAL Core — but porting it would mean **files gain a combined, cross-tab listing capability that doesn't exist today**, alongside (or instead of) the three separate per-tab endpoints `file-manager-tabs` already ships. That is a separate, materially larger backend design question, not a natural extension of "which tabs are visible."

**Available config-registry infrastructure** (verified in `apps/chat-api/src/app-config/`): `CONFIG_DEFINITIONS: ConfigDefinition[]` already declares client-visible, non-boolean `type: 'config'` entries (`asr.modelId`, `deployments.defaultDeploymentId`) resolved through `CompositeConfigProvider` → `EnvConfigProvider` (with two existing special-cased derived keys handled as inline branches) → `StaticDefaultsProvider`, exposed through `GET /api/v1/client-config?appId=chat-ui`, cached 60s per `appId:userId:roles`. `environment.config.ts` has a proven CSV-string-to-`string[]` `@Transform` pattern (`FEATURED_MODEL_IDS`, `HIDDEN_ENTITY_TAGS`, `ASR_ENABLED_ROLES`).

**Deployment features precedent** (`apps/chat-api/src/deployments/`): `folderAttachments` (and similar) are booleans attached to a *specific AI model/application deployment* (`DeploymentItemDto.folderAttachments`), resolved from that deployment's own `features.folder_attachments` flag in DIAL Core's deployment metadata. This is a fundamentally different scope than "which File Manager tabs exist" — the latter is an app/tenant-wide UI concern with no relationship to any individual model deployment.

## Goals / Non-Goals

**Goals:**

- Let an operator restrict which of the three currently-supported tabs a deployment shows, via one env var, through the existing client-config mechanism — no new endpoint.
- Preserve today's exact 3-tab behavior as the default.
- Handle both the initial-mount and async-arrival edge cases where the active tab is not in the resolved tab list (port legacy's `getInitialTab` fallback, extended to also cover post-mount correction).
- Give a firm, evidence-based answer on file-level `sharedWithMe`/`publishedWithMe` filters rather than a placeholder waiver.

**Non-Goals:**

- Implementing file-level `sharedWithMe`/`publishedWithMe` filtering — waived (see Open Questions for the concrete follow-up path).
- Adding `review` to the allowed tab id set — no implementation exists for it until (and unless) `add-file-manager-review-tab` ships.
- Role-based gating of the tab list. `ConfigDefinition.allowedRolesEnvVar` is explicitly documented as "only valid for type='feature'" (`app-config.types.ts:15-17`); `fileManager.availableTabs` is `type: 'config'`.
- Any change to the destination-folder popup — it has no independent tab UI in either legacy or current code and needs none here.

## Decisions

**D1 — BFF/config source: client-config registry, not a deployment-features DTO field, not a config-registry-only static fallback.**

| Option | Assessment |
|--------|------------|
| **Deployment features DTO** (extend `DeploymentItemDto`/`DeploymentDetailsDto` with `fileManagerTabs?: string[]`, similar to `folderAttachments`) | **Rejected.** `folderAttachments`-style fields describe a capability of *one specific AI model/application deployment* — they answer "can this model accept folder attachments," a question scoped to that deployment's own metadata. "Which File Manager tabs exist" has no relationship to any individual deployment; it is an app-wide/tenant-wide UI setting. Modeling it as a per-deployment field would force every deployment in a tenant to agree (or force picking one arbitrary deployment's value), which doesn't match the actual question being asked. |
| **Client-config registry** (this change) | **Chosen.** `AppConfigService`/`CompositeConfigProvider` already exists exactly for client-visible, deployment-operator-configurable, cached values with no per-model scope (`asrModelId`, `defaultDeploymentId`, feature flags). Adding a key here is a few-line registry addition reusing existing caching/versioning/auth. |
| **Config-registry-only static fallback** (no env var, hardcoded default only, revisit later if a real deployment need appears) | **Rejected.** The issue explicitly asks for deployment-driven tabs (step 18 of #7505), and legacy's `availableTabs` — while not deployment-driven itself — establishes that *some* mechanism for narrowing the tab set is a real, already-recognized need (it just lived as a prop instead of a config key). A static-only fallback would not satisfy that requirement at all; it would just be today's hardcoded behavior with a different code location. |

Since legacy was **not** deployment-driven (Context above), there is no legacy precedent obligating a specific source — the choice is made on what the *current* codebase and product intent (deployment-driven, per the issue) actually need, which points squarely at the client-config registry.

**D2 — BFF-side allow-list validation, not raw pass-through.** (Unchanged from the original design: filters `FILE_MANAGER_AVAILABLE_TABS` against `['my_files', 'shared', 'organization']` inside `EnvConfigProvider`, following the existing `features.asrEnabled`/`features.llmConversationNaming` inline-branch pattern. An empty-after-filtering result falls through to the registry default rather than rendering zero tabs.)

**D3 — Shared `useDialFileManagerTabConfig` hook owns both tab-filtering and active-tab-reset.**
Considered leaving each host to independently filter `allTabs` and separately implement a reset `useEffect`. Rejected — both hosts need identical behavior with no per-instance variation, so duplicating a `useEffect` (with its dependency array and reset-priority logic) in two files is exactly the kind of "three similar lines is fine, but this is stateful side-effect logic, not three similar lines" case that belongs in one hook. `useDialFileManagerTabConfig(activeTab, onTabChange, allTabs)`:
1. Reads `useAppConfig().config.fileManagerTabs`.
2. Returns `tabs = allTabs?.filter((tab) => fileManagerTabs.includes(tab.id))`.
3. Runs a `useEffect` that, whenever `fileManagerTabs` or `activeTab` changes, checks if `activeTab` is still present in `fileManagerTabs`; if not, calls `onTabChange` with the first id in the fixed priority `my_files → shared → organization` present in `fileManagerTabs` (falling back to `my_files` if the resolved list is ever empty, which D2 already prevents in practice).

This covers **both** required cases: (a) initial mount, where a deployment excludes `my_files` and the host's `useDialFileManagerTabs(tabLabels, DialFileManagerTabs.MyFiles)` call would otherwise default to an unavailable tab; and (b) the async-arrival race, where `AppConfigContext`'s `INITIAL_STATE.config.fileManagerTabs` (defaulting to all three tabs, so the UI doesn't flash an incomplete tab bar while loading) resolves to a narrower list *after* the host already rendered with `my_files` active — the effect corrects the active tab once the real config lands.

**D4 — File-level source filters remain waived, with the precedent now explicit.**
The `conversation.service.ts` merge-and-flag pattern (Context above) proves feasibility, but adopting it for files would introduce a **combined, cross-tab listing** capability that doesn't exist in the current file-manager architecture — every one of `file-manager-tabs`'s already-shipped requirements (separate per-tab fetch, separate cache/invalidation, separate `sharedByMePaths`/`sharedWithMeIds` path-set wiring) assumes tab-scoped, not cross-tab, listings. Introducing a parallel combined-listing mechanism just to backfill `sharedWithMe`/`publishedWithMe` booleans — when the existing tab-scoped fetch already tells the UI "this item is on the Shared tab" — would duplicate information the architecture already has in a different, already-correct shape. This is a design question for a dedicated follow-up (does product actually want a *cross-tab* facet, e.g. "show items shared with me while browsing My files"?), not an extension of tab visibility configuration.

## Risks / Trade-offs

- **[Risk] An operator sets `FILE_MANAGER_AVAILABLE_TABS` to a single tab and every user loses access to their own files.** → Mitigation: intentional deployment-operator capability; D3's reset ensures the app does not crash or show a blank tab bar.
- **[Risk] Stale 60s client-config cache means a mid-session config change is not picked up until the next fetch.** → Mitigation: identical to every other value already served through this endpoint — no new caching risk. D3's reset effect specifically exists to correct the UI once a fresh value *does* arrive, whether that's on first load or (if `AppConfigProvider` is ever changed to poll) later.
- **[Risk] Frontend and BFF versions could drift.** → Mitigation: `useDialFileManagerTabConfig`'s filter intersects against `allTabs` (ui-kit's own known-tab list) first, so an unrecognized id from a newer BFF is silently ignored by an older frontend — the same defensive intersection the current hardcoded `.filter()` already performs today.

## Migration Plan

Additive, defaulting to today's exact behavior. Rollback is reverting the impacted files; no data migration, no breaking generated-client change.

## Open Questions

- **File-level `sharedWithMe`/`publishedWithMe` filters (waived here, concretely scoped)**: the follow-up work is: (1) confirm with product whether the actual want is a *cross-tab* facet (item shows up while browsing `my_files` but is flagged "shared with me") as opposed to today's tab-scoped browsing being sufficient; (2) if confirmed, port `conversation.service.ts:655-777`'s merge-and-flag pattern to `FilesService`, which will require reconciling it against `file-manager-tabs`'s already-shipped separate-endpoint-per-tab caching model (either the combined listing replaces per-tab fetches, or it becomes a fourth, additive query used only for the cross-tab facet).
- Should `FILE_MANAGER_AVAILABLE_TABS` support per-role overrides later? Not needed today; `type: 'config'` entries don't currently support `allowedRolesEnvVar` (D1/Non-Goals) — flagged so a future change doesn't have to rediscover the constraint.
