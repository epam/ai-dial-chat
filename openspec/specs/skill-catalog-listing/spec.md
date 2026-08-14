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

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL read `skills` and `publicSkills` from `useSkills()` and, when `OverlayFeature.Skills` is enabled, append them to the `catalogItems` memo through `mapSkillToCatalogItem` — personal entries with `SkillSource.Personal`, organisation entries with `SkillSource.Public` — alongside the existing deployment, toolset, and prompt branches.

`skills`, `publicSkills`, and the feature flag SHALL be listed in the `catalogItems` `useMemo` dependency array.

`CatalogView`'s `isLoading` SHALL additionally include the skills context's `isLoading`, so the catalog's existing skeleton covers the skill listing.

Skill items SHALL flow through the catalog's existing search, sort, topic filter, folder grouping, card view, and list view with no per-type branching, since `filterCatalogItems`, `buildCatalogTabs`, and the list-view columns already key off `item.type` generically.

#### Scenario: Personal and organisation skills both listed

- **WHEN** the context exposes two personal skills and one organisation skill and the feature is enabled
- **THEN** `catalogItems` contains three `CatalogEntityType.Skill` items, two with `isMyApp: true` and one with `isMyApp: false`

#### Scenario: Skills participate in search

- **WHEN** the user types a query matching a skill's name
- **THEN** that skill appears in the filtered results with its match highlighted by the catalog's existing result rendering

#### Scenario: Loading state covers the skill listing

- **WHEN** deployments and favourites have resolved but the skill listings have not
- **THEN** `CatalogView` still reports a loading state

#### Scenario: Selector mode excludes skills

- **WHEN** `CatalogView` renders in `isSelectorMode`
- **THEN** no skill item is shown, because `PICKER_VISIBLE_TYPES` contains only `Model` and `Agent`

---

### Requirement: Every mutating and runtime action is hidden for a skill

`CatalogView` SHALL extend its existing action-visibility predicates so that, for an item whose `type` is `CatalogEntityType.Skill`:

- `isPrimaryActionVisible(item)` returns `false` — a skill is not a runtime a conversation can target.
- `isPublishVisible(item)` returns `false`.
- `isShareVisible(item)` returns `false`.
- `isDownloadVisible(item)` returns `false`.

No `Skill` entry SHALL be added to the Create dropdown, and no skill route or editor SHALL be registered. `mapSkillToCatalogItem` sets `isEditable: false`, so the Edit affordance is absent.

All four decisions live in the host predicates already declared on `CatalogProps`; `libs/catalog`'s built-in defaults in `Header.tsx` SHALL NOT be changed to know about `Skill`.

The skill's DIAL Core `permissions` array is carried through the mapping but SHALL NOT enable any action.

#### Scenario: Details panel for a skill shows no mutating actions

- **WHEN** a user opens the details panel for any skill, personal or organisation
- **THEN** no primary action, publish, share, download, edit, or delete control is rendered

#### Scenario: A `WRITE` permission does not unlock actions

- **WHEN** a personal skill's `permissions` include `WRITE`
- **THEN** the details panel still renders no mutating action

#### Scenario: Create dropdown is unchanged

- **WHEN** the Create dropdown is opened with `OverlayFeature.Skills` enabled
- **THEN** it offers exactly the entries it offered before skills were listed, with no Skill option

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
