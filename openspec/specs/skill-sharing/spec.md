# skill-sharing Specification

## Purpose
Frontend `CatalogView` wiring that exposes Share (owner-only), Unshare/"Remove from My List" (recipient-only), and Revoke access (owner-only) for Skill catalog items, reusing the generic `SharePopoverContainer`/`useShareLink`/`libs/catalog` Header controls with no skill-specific UI code. Sharing eligibility is ownership-based (`isMyApp`) and independent of the permission-based Edit action (`isEditable`/`canEdit`).

## Requirements
### Requirement: Skill Share action visibility is ownership-based

`CatalogView.isShareVisible` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL return `Boolean(item.isMyApp)` for `item.type === CatalogEntityType.Skill`, mirroring the existing `Prompt` branch's ownership check rather than the `Toolset`/`Application` branches' feature-flag check.

A skill's Share eligibility SHALL depend only on `item.isMyApp` (personal-bucket ownership, computed in `mapSkillToCatalogItem` — `apps/chat/src/utils/map-skill-to-catalog-item.ts:72`), never on `item.isEditable`/`canEdit` (the `WRITE` permission bit). A skill shared to the current user with `WRITE` permission SHALL NOT expose the Share action merely because it is editable.

`libs/catalog`'s built-in Share gating (`shouldShowShare = item.isMyApp === true` in `ShareButton.tsx`) already enforces this rule uniformly for every `CatalogEntityType`; this requirement makes `CatalogView`'s per-type override consistent with it for Skill specifically, replacing the current unconditional `return false`.

#### Scenario: Owned skill exposes Share

- **GIVEN** a personal skill catalog item with `isMyApp: true`
- **WHEN** the details panel's action row is rendered
- **THEN** the Share action is visible

#### Scenario: Writable shared skill does not expose Share

- **GIVEN** a skill catalog item with `isMyApp: false`, `sharedWithMe: true`, and `isEditable: true` (the current user holds `WRITE` on it)
- **WHEN** the details panel's action row is rendered
- **THEN** the Share action is NOT visible, even though the skill is editable

#### Scenario: Read-only shared skill does not expose Share

- **GIVEN** a skill catalog item with `isMyApp: false`, `sharedWithMe: true`, and `isEditable: false`
- **WHEN** the details panel's action row is rendered
- **THEN** the Share action is NOT visible

#### Scenario: Public skill never exposes Share

- **GIVEN** a skill catalog item sourced from the public namespace (`isMyApp: false`, `isEditable: false`, `sharedWithMe: false`)
- **WHEN** the details panel's action row is rendered
- **THEN** the Share action is NOT visible, and the item exposes no other ownership actions (Revoke access, Delete)

### Requirement: Skill sharing reuses the generic catalog sharing infrastructure with no skill-specific code

Sharing a skill SHALL go through the exact same components and calls used for applications and toolsets today: `SharePopoverContainer` (`apps/chat/src/components/SharePopoverContainer/SharePopoverContainer.tsx`), `useShareLink` (`apps/chat/src/hooks/useShareLink/useShareLink.ts`), and `createShareLink`/`getShareLink` (`apps/chat/src/server-api/share.api.ts`, `apps/chat/src/utils/share-link.ts`).

`SharePopoverContainer` SHALL NOT resolve a `resourceKind` for `CatalogEntityType.Skill` — its `item.id` is already the fully-qualified `skills/{ownerBucket}/{skillPath}` DIAL Core resource URL (set in `mapSkillToCatalogItem`, `map-skill-to-catalog-item.ts:52`), so no server-side bucket qualification is needed, unlike the `Prompt` branch which supplies `CreateShareLinkDtoResourceKindEnum.Prompt` for its bucket-relative path.

`SharePopoverContainer.EDITABLE_ACCESS_TYPES` already includes `CatalogEntityType.Skill`; this requirement does not change that set, only confirms the popover's edit-access dropdown is available when a skill share link is created.

`libs/catalog`, `SharePopoverContainer`, `useShareLink`, and `apps/chat/src/server-api/share.api.ts` SHALL NOT gain any skill-specific branch, import, or resource-path-construction logic — a skill's `itemId` is passed through unmodified, identically to an application's or a toolset's.

#### Scenario: Creating a share link for an owned skill

- **WHEN** the owner of a personal skill opens the Share popover and requests a link
- **THEN** `createShareLink` is called with `itemId = item.id` (the full `skills/{bucket}/{path}` URL) and no `resourceKind`, identically to the existing Application/Toolset flow

#### Scenario: No skill-specific code exists in the sharing path

- **WHEN** `libs/catalog`, `SharePopoverContainer.tsx`, `useShareLink.ts`, and `apps/chat/src/server-api/share.api.ts` are searched for a `Skill`-specific conditional branch related to resource-path construction
- **THEN** none is found; the only `Skill`-aware line in this path is `SharePopoverContainer.EDITABLE_ACCESS_TYPES`'s existing membership check, unchanged by this capability

### Requirement: Skill sharing stays behind the existing Skills feature gate

Skill Share/Unshare/Revoke visibility SHALL be gated only by the existing `OverlayFeature.Skills` flag (already read in `CatalogView.tsx` and `SkillsContext.tsx` to control whether skills appear in the catalog at all). No new `OverlayFeature.SkillsSharing`-style flag SHALL be introduced for this capability, unlike the separate `ApplicationsSharing`/`ToolsetsSharing` flags layered on top of their respective base flags.

When `OverlayFeature.Skills` is disabled, no skill catalog items are rendered at all (existing behavior, unchanged), so the sharing actions are moot; when it is enabled, skill sharing visibility follows the ownership rule above with no additional flag check.

#### Scenario: Skills feature disabled hides sharing along with the rest of the skill catalog

- **GIVEN** `OverlayFeature.Skills` is disabled for the current session
- **WHEN** the catalog is rendered
- **THEN** no skill catalog items (and therefore no skill Share/Unshare/Revoke actions) appear, consistent with existing catalog-visibility behavior

#### Scenario: Skills feature enabled exposes sharing with no separate flag check

- **GIVEN** `OverlayFeature.Skills` is enabled and the current user owns a skill
- **WHEN** the details panel is rendered
- **THEN** the Share action is visible without checking any additional sharing-specific feature flag

### Requirement: Edit and Share are independent actions for skills

A skill's Edit action visibility SHALL continue to be governed exclusively by `item.isEditable` (`!isPublic && (skill.canEdit ?? isPersonal)`, `map-skill-to-catalog-item.ts:74`), unchanged by this capability. Edit and Share SHALL be evaluated independently: a skill's Share visibility (ownership-based, per the first requirement in this capability) has no bearing on its Edit visibility (permission-based), and vice versa.

#### Scenario: Writable shared skill exposes Edit but not Share

- **GIVEN** a skill catalog item with `isMyApp: false`, `isEditable: true` (shared with `WRITE`)
- **WHEN** the details panel is rendered
- **THEN** the Edit action is visible and the Share action is NOT visible

#### Scenario: Owned skill exposes both Edit and Share

- **GIVEN** a skill catalog item with `isMyApp: true` (personal, therefore `isEditable: true`)
- **WHEN** the details panel is rendered
- **THEN** both the Edit action and the Share action are visible

#### Scenario: Read-only shared skill exposes neither Edit nor Share

- **GIVEN** a skill catalog item with `isMyApp: false`, `isEditable: false` (shared with `READ` only)
- **WHEN** the details panel is rendered
- **THEN** neither the Edit action nor the Share action is visible

### Requirement: i18n, RTL, mobile, and accessibility are inherited unchanged

No new i18n keys SHALL be introduced for the Share action itself — `SharePopoverContainer` already sources every user-visible string (`ShareI18nKeys`, `ButtonsI18nKeys`) generically for every `CatalogEntityType`, including `Skill`. New keys, if any are needed for skill-specific Unshare/Revoke notification text, SHALL follow the `catalog-unshare`/`share-revoke-access` capabilities' existing key-reuse pattern (interpolating `{{name}}` with the skill's name into the same generic message templates already used for applications/toolsets) rather than introducing a parallel `skill.*` namespace.

RTL, mobile, keyboard, and WCAG 2.1 AAA behavior of the Share popover, the Manage-menu entries, and the confirmation sub-views SHALL be inherited unchanged from the existing `libs/catalog`/`SharePopoverContainer`/`@epam/ai-dial-share` components — no skill-specific styling, layout, or ARIA logic SHALL be added, since these components already render identically regardless of `CatalogEntityType`.

#### Scenario: No new i18n keys for the Share popover itself

- **WHEN** the Share popover is opened for a skill
- **THEN** every label it renders resolves through the existing generic `ShareI18nKeys`/`ButtonsI18nKeys` keys already used for applications and toolsets, with no skill-specific key added

#### Scenario: RTL rendering matches other entity types

- **GIVEN** `dir="rtl"` is set on the document
- **WHEN** the Share popover or the Manage-menu Share/Unshare/Revoke entries are rendered for a skill
- **THEN** layout, icon mirroring, and logical-property usage are identical to the existing application/toolset rendering — no skill-specific RTL code path exists

### Requirement: Tests for skill sharing visibility

`apps/chat/src/components/CatalogView/tests/CatalogView.spec.tsx` SHALL cover `isShareVisible`, `isUnshareVisible`, and `isRevokeShareVisible` for `CatalogEntityType.Skill` across: an owned skill (all three visible, subject to `sharedWithMe`/ownership as applicable), a writable shared skill (`isEditable: true`, `isMyApp: false` — Share and Revoke not visible, Unshare visible), a read-only shared skill (`isEditable: false`, `isMyApp: false` — same visibility as writable-shared for these three predicates, since none of them read `isEditable`), and a public skill (none of the three visible).

#### Scenario: Predicate test matrix passes for every ownership/permission combination

- **WHEN** `CatalogView.spec.tsx`'s skill-sharing test cases are run
- **THEN** `isShareVisible`, `isUnshareVisible`, and `isRevokeShareVisible` each return the expected boolean for owned, writable-shared, read-only-shared, and public skill fixtures
