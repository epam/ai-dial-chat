# catalog-primary-action Specification

## Purpose

Defines how `libs/catalog`'s `Header.tsx` resolves at most one primary action per catalog item — Credentials, Download, or Use in chat — including the `isDownloadPrimary` host override, its precedence against the existing Toolset credentials swap, and the pending-state contract for a primary-action download.

## Requirements


### Requirement: The primary action's identity is resolved by entity type, with a host override

`Header.tsx` SHALL resolve, for a given item, at most one primary action from the following, evaluated in this order, with the first matching branch rendering and every other branch SHALL NOT render for that same item:

1. **Credentials** (Log in / Log out / Manage credentials) — unchanged, existing behavior: `item.type === CatalogEntityType.Toolset` and credentials are available for the item.
2. **Download** — new in this revision: `onDownload` is supplied for the item, `isDownloadVisible?.(item) ?? true` is `true`, and `isDownloadPrimary?.(item) ?? item.type === CatalogEntityType.Skill` is `true`.
3. **Use in chat** — unchanged, existing behavior: `texts?.hasPrimaryAction !== false` and `isPrimaryActionVisible?.(item) ?? (item.type === CatalogEntityType.Model || CatalogEntityType.Agent || CatalogEntityType.Prompt)` is `true`.
4. **None** — no branch above matched.

`DetailsPanelProps` and `CatalogProps` SHALL each add:

```ts
isDownloadPrimary?: (item: CatalogItem) => boolean;
```

`Catalog` SHALL forward it to `DetailsPanel`, which SHALL forward it to `Header`, unmodified, following the exact forwarding pattern already used for `isPrimaryActionVisible`, `isDownloadVisible`, and every other action-visibility predicate in this file.

The lib SHALL treat `CatalogEntityType` as the only entity-type knowledge this requirement needs; it SHALL NOT gain any Skill-specific, bucket-specific, or resource-path-specific knowledge to implement this rule.

#### Scenario: Skill defaults to Download as its primary action

- **WHEN** an item's `type` is `CatalogEntityType.Skill`, `onDownload` is supplied, `isDownloadVisible` is absent, and `isDownloadPrimary` is absent
- **THEN** the primary action renders as Download and no "Use in chat" button renders for that item

#### Scenario: Model keeps "Use in chat" as its primary action

- **WHEN** an item's `type` is `CatalogEntityType.Model`
- **THEN** the primary action renders as "Use in chat", unaffected by whether `onDownload`/`isDownloadPrimary` are supplied

#### Scenario: Toolset's credentials swap takes precedence over Download

- **WHEN** an item's `type` is `CatalogEntityType.Toolset` and credentials are available, and the host also supplies `isDownloadPrimary` returning `true` for Toolset items
- **THEN** the primary action still renders as the credentials action, not Download

#### Scenario: A host can suppress Skill's default Download promotion

- **WHEN** the host supplies `isDownloadPrimary={() => false}`
- **THEN** no item's Download is promoted to primary, regardless of `item.type`, and Skill's Download renders in the Manage menu instead (subject to `isDownloadVisible`)

#### Scenario: A host can promote Download for a type other than Skill

- **WHEN** the host supplies `isDownloadPrimary={(item) => item.type === CatalogEntityType.Prompt}` and `onDownload` is supplied for a Prompt item
- **THEN** that Prompt's Download renders as its primary action instead of "Use in chat"

#### Scenario: An entity type with no matching branch shows no primary action

- **WHEN** an item's `type` matches none of Skill/Model/Agent/Prompt/Toolset and no override predicate returns `true` for it
- **THEN** no primary action renders for that item, unchanged from today

---

### Requirement: A promoted Download action never also appears in the Manage menu

`Header.tsx`'s existing Manage-menu inclusion rule for Download (`shouldShowDownloadAction`) SHALL additionally require that the item's Download is **not** currently resolved as the primary action, per the previous requirement. An item whose Download is primary SHALL NOT show a "Download" entry in its Manage (ellipsis) menu.

An item whose Download is **not** primary (every entity type other than Skill, unless overridden) SHALL continue to show "Download" in the Manage menu exactly as it does today, with no behavior change: fire-and-forget `onClick`, no pending state, no `aria-busy`, no status region.

#### Scenario: Skill's Manage menu has no Download entry

- **WHEN** an item's Download is resolved as primary
- **THEN** its Manage (ellipsis) menu, if rendered at all, contains no "Download" entry

#### Scenario: Prompt's Manage-menu Download is unaffected

- **WHEN** an item's Download is not resolved as primary (e.g. a Prompt, with no `isDownloadPrimary` override)
- **THEN** its Manage menu still contains a "Download" entry, and clicking it still calls `onDownload` without awaiting it or showing a pending state

#### Scenario: Download is never rendered in two places at once

- **WHEN** any item is inspected, regardless of type or override
- **THEN** at most one Download affordance (primary button or Manage-menu entry) is rendered for it, never both

---

### Requirement: The promoted Download button reflects a pending request; the Manage-menu entry's contract is unchanged

`onDownload?: (item: CatalogItem) => Promise<void> | void` SHALL keep its existing signature. When invoked from the Manage-menu entry, it SHALL continue to be fire-and-forget, exactly as documented before this capability existed.

When invoked from the primary-action Download button, `Header` SHALL await the call and track a local pending state (`isDownloading`) for the duration:

- While pending, the button SHALL be `disabled` and SHALL carry `aria-busy="true"`.
- A click while already pending SHALL NOT invoke `onDownload` again — at most one call SHALL be in flight per item at a time from the primary button.
- A `role="status"` region SHALL announce `texts?.downloadingStatusLabel ?? 'Downloading'` while pending, and SHALL be absent (not merely empty) once the call settles, mirroring the present/absent-region convention this lib already uses for other loading states.
- `isDownloading` SHALL reset to `false` whenever `item.id` changes, regardless of whether a prior call for the previous item is still pending; a prior call's eventual settlement SHALL NOT re-set `isDownloading` to `true` for a different item.
- The pending state SHALL be cleared whether `onDownload` resolves or rejects (a `finally`-equivalent guarantee) — a rejection SHALL leave the button enabled again, not stuck disabled.

#### Scenario: The button disables itself while a download is in flight

- **WHEN** the primary Download button is activated and `onDownload`'s returned promise has not yet settled
- **THEN** the button is `disabled`, carries `aria-busy="true"`, and a `role="status"` region announces the downloading label

#### Scenario: A second click while pending starts no second call

- **WHEN** the primary Download button is activated, and activated again before the first call settles
- **THEN** `onDownload` has been called exactly once

#### Scenario: The button re-enables after success

- **WHEN** `onDownload`'s promise resolves
- **THEN** the button is no longer `disabled` or `aria-busy`, and the status region is no longer present

#### Scenario: The button re-enables after failure

- **WHEN** `onDownload`'s promise rejects
- **THEN** the button is no longer `disabled` or `aria-busy` — the pending state does not survive a failure

#### Scenario: Switching items during a pending download leaves no stale indicator

- **WHEN** the primary Download button is activated for item A, and before `onDownload` settles the panel renders item B instead
- **THEN** item B's Download button (if it has one) shows no pending state as a result of A's still-in-flight call, and A's eventual settlement — whenever it occurs — does not retroactively show a pending state for B

#### Scenario: The Manage-menu entry's own contract is untouched

- **WHEN** an item's Download renders in the Manage menu (not as primary)
- **THEN** clicking it calls `onDownload` without the panel awaiting it, showing a pending state, or disabling anything — identical to this capability's behavior before `isDownloadPrimary` existed

---

### Requirement: i18n, accessibility, RTL, and responsive contract for the promoted Download action

- **i18n**: the promoted button's label SHALL be `texts?.downloadActionLabel ?? 'Download'` — the same prop the Manage-menu entry already reads, not a new one. A new `texts.downloadingStatusLabel` SHALL default to `'Downloading'`, following the naming convention already established by `deletingStatusLabel`/`unsharingStatusLabel`/`revokingShareStatusLabel`/`loggingOutStatusLabel`. `libs/catalog` SHALL NOT call `useTranslation`.
- **Accessibility**: the button's accessible name SHALL come from its `label`. Keyboard activation SHALL work identically to every other button in the header (native `<button>`, Tab-reachable, Enter/Space-activatable). Focus SHALL NOT move or become trapped as a result of activating the button, succeeding, or failing.
- **Touch target**: the button SHALL use the header's existing button sizing, which already satisfies a 44×44 CSS pixel minimum touch target; no new size variant is introduced.
- **RTL**: the button's icon (`IconDownload`) SHALL NOT be mirrored — it is a symmetric, concept-representing glyph, not a directional one. The button SHALL use the header's existing logical spacing.
- **Responsive**: the button SHALL render inside the header's existing wrapping action row, which already avoids horizontal overflow at a 360px viewport and at the 769px desktop boundary; no new breakpoint-specific rule is introduced.
- **No hover dependency**: activation and all pending-state feedback SHALL be available without a `:hover` affordance.

#### Scenario: No hardcoded English beyond the two reused/new defaults

- **WHEN** the Download-related code in `Header.tsx` is inspected
- **THEN** it contains no `useTranslation` call, and its only strings are `texts.downloadActionLabel` (reused) and `texts.downloadingStatusLabel` (new), both with English defaults

#### Scenario: No horizontal overflow at mobile width

- **WHEN** a skill's details panel header renders at a 360px viewport width
- **THEN** the primary Download button, Share button, and Manage control (if present) wrap within the row without causing the panel to overflow horizontally

#### Scenario: The download icon is not mirrored in RTL

- **WHEN** the document direction is `rtl`
- **THEN** `IconDownload` renders in its normal, unmirrored orientation
