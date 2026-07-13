## Context

The Catalog details panel already supports a generic "Edit" action
(`catalog-quickapp-edit-action`): `CatalogItem.isEditable` gates a `NeutralButton` next to
"Use in chat", and `CatalogView.onEdit` handles the navigation. Today only QuickApp-schema
deployments set `isEditable`; `mapToolsetToCatalogItem` never does, and `CatalogView`'s edit
handler and `isPrimaryActionVisible` only branch on `Model`/`Application`. The
`/toolset-editor` route (`apps/chat/src/pages/ToolsetEditor/ToolsetEditor.tsx`) already
supports editing an existing toolset when `ToolsetEditorQuery.Id` is present in the URL —
this change only needs to point the existing details-panel Edit button at that entry mode
for toolsets.

## Goals / Non-Goals

**Goals:**

- Show an "Edit" action in the Catalog details panel for toolsets owned by the current user.
- Clicking it opens `/toolset-editor?id=<toolsetId>&returnUrl=/catalog`, landing on the
  existing edit-mode flow with the toolset's current values pre-loaded.
- Reuse the existing `isEditable`/`onEdit` mechanism as-is — no changes to `libs/catalog`.

**Non-Goals:**

- No change to who can edit (ownership check stays `isMy`, no new role/permission model).
- No change to the ToolsetEditor page itself, its steps, or its save/validation behavior.
- No kebab/dropdown menu — the single Edit button pattern used for QuickApps is sufficient
  and keeps the two entity types visually consistent.

## Decisions

- **`isEditable` = `toolset.isMy ?? false`, no schema-type gate.** Unlike QuickApps (which
  are one schema among many application types, so `isEditable` also checks
  `applicationTypeSchemaId`), every toolset the user owns is inherently editable — there is
  no "toolset schema variant" to exclude. This keeps the mapping a one-line change and avoids
  inventing an unnecessary gate.
- **`onEdit` dispatch branches on `item.type` inside `CatalogView`, not a second prop.**
  `Catalog` (`libs/catalog`) already exposes a single `onEdit?: (item: CatalogItem) => void`
  prop. Rather than adding a `libs/catalog` API surface for a second entity type,
  `CatalogView`'s existing `handleEditApp` callback is generalized to check
  `item.type === CatalogEntityType.Toolset` first and build the `ToolsetEditor` URL,
  otherwise falling through to the existing QuickApp `buildEditorUrl` path. This matches the
  "one `onEdit`, app decides per-type" contract already implied by the lib's design.
- **Reuse `ToolsetEditorQuery` and `ROUTES.ToolsetEditor` as-is.** The "Create Toolset" option
  in `CatalogView.createOptions` already builds a `ToolsetEditor` URL with only
  `ReturnUrl` set; the edit path adds `ToolsetEditorQuery.Id` to the same `URLSearchParams`
  construction, following the same pattern rather than introducing a second helper.
- **`isPrimaryActionVisible` is left unchanged for toolsets** (still `false` for
  `Toolset`/`Agent`/etc. — only `Model`/`Application` show "Use in chat" as a primary action
  in the details header outside of the edit button). This is orthogonal to Edit visibility,
  which is governed solely by `isEditable` + `onEdit` per the existing lib contract.

## Risks / Trade-offs

- [Toolsets owned by others but shared/visible in Catalog would show no Edit button, same as
  QuickApps] → Matches existing, already-accepted `isMy`-gated behavior; not a regression.
- [Generalizing `handleEditApp` to branch on entity type increases its complexity slightly]
  → Kept as a single `if` branch with an early return per type, consistent with the existing
  small-function style in `CatalogView.tsx`; no extraction needed at this size.
