# skill-catalog-listing Specification

## Purpose

Defines how skills surface as first-class items in the catalog: the overlay feature key that gates the entire skill surface, how skill items merge into `CatalogView`'s item list, why every mutating and runtime action is suppressed for a skill, and the listing's failure, i18n, RTL, and accessibility contract.

## Requirements

### Requirement: `OverlayFeature.Skills` gates the entire skill surface

`libs/chat-overlay/src/protocol/overlay-protocol.ts` SHALL add `Skills = 'skills'` to the `OverlayFeature` enum with a JSDoc line describing what it enables (the catalog's Skills tab and skill details). The addition is additive: an overlay host that does not send `skills` gets today's behaviour.

`apps/chat` SHALL read it through the existing `useUiFeature(OverlayFeature.Skills)` hook, gating both the skill listing requests in `SkillsProvider` and skill items entering `CatalogView`'s item list.

This is an overlay feature key, not an `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` server-side flag; no role restriction applies.

#### Scenario: Feature disabled

- **WHEN** `OverlayFeature.Skills` is not enabled
- **THEN** no skill item enters `catalogItems`, `buildCatalogTabs` derives no Skills tab, and the catalog renders exactly as it does without this change

#### Scenario: Feature enabled with at least one skill

- **WHEN** `OverlayFeature.Skills` is enabled and the caller's bucket holds at least one skill
- **THEN** the catalog tab row includes a Skills tab and the skill appears under it

---

### Requirement: Skills merge into `CatalogView`'s item list

When Skills are enabled, `CatalogView` SHALL append personal `skills`, `sharedWithMe`, and `publicSkills` from `useSkills()` through `mapSkillToCatalogItem` with their matching `SkillSource`. All three arrays and the feature flag SHALL be memo dependencies. The shared array SHALL also participate in metadata lookup when details are fetched.

#### Scenario: All skill sources are listed

- **WHEN** the context exposes one personal, one shared, and one public skill
- **THEN** the catalog contains all three under their Personal, Shared, and Public source folders

#### Scenario: Selector mode still excludes skills

- **WHEN** the catalog renders in deployment-selector mode
- **THEN** no skill item is shown

---

### Requirement: Unsupported actions are hidden for a skill

Skills SHALL continue to hide Use in chat, Share, Download, Delete, Unshare, and Revoke access. No Skill entry is added to the Create dropdown by this capability. Edit is available when `item.isEditable` is true. Publish is available only when `item.isMyApp` is true; shared-with-me and public skills SHALL remain unpublishable even when `canEdit` is true. `CatalogView.handleEdit` SHALL navigate to `/skill-editor?id=<full skill resource URL>&returnUrl=/catalog`.

The decision remains at the app edge through `CatalogItem.isEditable` and `CatalogView`'s callbacks; `libs/catalog` gains no bucket, permission, route, or generated-client knowledge.

#### Scenario: Personal skill exposes Edit and Publish

- **WHEN** a user opens their personal skill
- **THEN** Edit and Publish are present while every unsupported mutating/runtime action remains absent

#### Scenario: Writable shared skill exposes Edit

- **WHEN** a shared skill has `canEdit: true`
- **THEN** Edit navigates with its full `skills/{ownerBucket}/{path}` id and Publish remains absent

#### Scenario: Public skill remains read-only

- **WHEN** a public skill is opened, even if metadata contains `WRITE`
- **THEN** no Edit, Publish, or other mutation action is rendered

---

### Requirement: Skill listing failure is surfaced without breaking the catalog

When the skills context reports a non-null `error`, `CatalogView` SHALL surface it once through the existing notification path (`useOperationNotification`) using the i18n key `catalog.skillsLoadError`, and SHALL continue rendering every other catalog item.

An empty listing is not an error: with no skills present, `buildCatalogTabs` simply derives no Skills tab, and no notification is raised.

#### Scenario: Listing error notifies and degrades

- **WHEN** both skill listings reject
- **THEN** one error notification is shown with the `catalog.skillsLoadError` message and the catalog still renders deployments, toolsets, and prompts

#### Scenario: Empty listing is silent

- **WHEN** both listings resolve with zero skills
- **THEN** no notification is raised and no Skills tab is rendered

---

### Requirement: i18n, RTL, and accessibility contract for the skill listing

- **i18n keys**: `catalog.tabSkills` (English `'Skills'`, passed into `CatalogTitles.tabLabels` for `CatalogEntityType.Skill`) and `catalog.skillsLoadError` (English `'Failed to load skills'`). The Personal / Public folder labels reuse the existing `CatalogI18nKeys.FolderPersonal` / `CatalogI18nKeys.FolderPublic` keys. Generic action words reuse `ButtonsI18nKeys`. Every key SHALL be declared in `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`.
- **RTL / direction impact**: none. No new layout, icon, or positioned element is authored — skills render through existing catalog components, which already use logical properties.
- **Accessibility**: no new interactive control is introduced. The tab, cards, list rows, and details panel carry the catalog's existing roles and labels; the error notification uses the notification surface's existing live region.
- **Memoisation**: the skill branch lives inside the existing `catalogItems` `useMemo`, and the extended action predicates stay inside the `useCallback`/`useMemo` wrappers they already have, so no new fetch effect is re-triggered on unrelated re-renders.
- **Observability**: no new metrics or analytics events. The only new emission is the pagination-truncation console warning specified in `skills-catalog-context`.
- **Caching**: no new client cache. Listings are read once per provider mount, and the context exposes no refetch callback (see `skills-catalog-context`); a later change that adds a skill mutation adds the refetch it needs alongside it.

#### Scenario: Tab label comes from i18n

- **WHEN** the catalog renders with the language set to English and at least one skill present
- **THEN** the Skills tab label is the resolved value of `catalog.tabSkills`, not the enum's fallback string

#### Scenario: No hardcoded user-visible strings

- **WHEN** the skill listing code is inspected
- **THEN** every user-visible string reaches the UI through `t()` with a key declared in `translation-keys.ts`
