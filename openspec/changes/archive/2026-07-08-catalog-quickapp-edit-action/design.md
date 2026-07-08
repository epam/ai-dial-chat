## Context

The Catalog details panel (`libs/catalog`) already renders a primary action button ("Use in chat") and a "Share" action via `Header.tsx`, wired through `CatalogProps` → `DetailsPanelProps` → `Header`'s own callback props. The lib holds no knowledge of hosts, routes, or DIAL Core concepts — `CatalogItem` only carries generic flags such as `isMyApp`. The Apps editor (`apps/chat/src/pages/AppsEditor`) already supports opening directly at its Settings step via `AppsEditorQuery` (`step`, `schema`, `appId`, `returnUrl`, `isCreating`); `CatalogView.tsx` already builds one such URL to create a new QuickApp (`AppsEditorStep.General` + `isCreating=true`).

There was previously no way to jump from an existing app's Catalog details entry into editing it.

## Goals / Non-Goals

**Goals:**

- Show an "Edit" action in the details panel header, positioned next to "Use in chat", for QuickApps the current user owns.
- Keep `libs/catalog` host-agnostic: the lib only exposes a generic `isEditable` flag and `onEdit` callback; it has no notion of "QuickApp" or "Apps editor".
- Reuse the existing Apps editor routing (`AppsEditorQuery`/`AppsEditorStep`) rather than adding a new route or query contract.

**Non-Goals:**

- Editing models or toolsets from the Catalog details panel (out of scope; `isEditable` is only ever set for QuickApp application deployments in this change).
- Any change to the Apps editor's own Settings-step behavior — it already handles being opened with a pre-existing `appId`.
- A new i18n key for the label — the existing `ButtonsI18nKeys.Edit` ("Edit") is reused.

## Decisions

- **Generic `isEditable` flag on `CatalogItem` instead of a QuickApp-specific field.** `libs/catalog` must stay app-agnostic (per AGENTS.md §Library isolation), so the lib cannot know about "QuickApp schemas". The host app (`apps/chat`) computes `isEditable` and passes it in as plain boolean data, the same pattern already used for `isMyApp`.
- **`isEditable` computed from `deployment.isMy && deployment.applicationTypeSchemaId === editableSchemaId`.** `applicationTypeSchemaId` (already present on `DeploymentItemDto`) is the only per-deployment signal for which schema built the app; matching it against the QuickApp schema id (resolved once via the existing `isQuickAppSchema` helper) avoids introducing a second, weaker heuristic. Restricting to `isMy` prevents showing Edit for QuickApps owned by other users.
- **`buildEditorUrl` generalized to a single parameterized function** (`{ schemaId, step, appId?, isCreating? }`) instead of near-duplicate URL-building code for create vs. edit. Both `createOptions`'s QuickApp entry and the new `handleEditApp` call the same helper, keeping the querystring contract in one place.
- **Edit navigates straight to `AppsEditorStep.Settings` with the existing `appId`**, mirroring how `AppsEditor.tsx` already resolves `appIdForSettings` from the `appId` query param when present — no new state or resume logic was needed there.
- **Button component/icon**: `NeutralButton` + `IconPencil`, matching the existing "Share" action's visual weight (secondary, not primary) since Edit is a per-item conditional action rather than the primary CTA.

## Risks / Trade-offs

- [`applicationTypeSchemaId` is undefined for very old deployments predating this field] → Edit action simply doesn't show (falls back to `isEditable: false`); no crash, matches existing "unknown → hide" pattern used elsewhere in this mapper.
- [Schema id matching is a string-equality heuristic on top of the pre-existing `isQuickAppSchema` heuristic (documented TODO in `application-schema.ts`)] → Accepted as consistent with how "Create QuickApp" already determines schema eligibility; no new fragility introduced.
- [Adding a new optional field/prop across `CatalogItem`, `ItemDetailsTexts`, `DetailsPanelProps`, `CatalogProps` touches several lib model files] → All additions are optional and default to hidden/no-op, so no existing consumer of `libs/catalog` breaks.
