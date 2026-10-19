# Spec: catalog-create-app

## Purpose

Defines the catalog's create menu: which options it offers, what gates each one, and where each navigates — including the Quick App option's application-schema resolution and its hand-off into the `/apps-editor` authoring flow.

## Requirements

### Requirement: The catalog create menu offers one option per authorable entity, each behind its own gate

`useCatalogEditNavigation` (`libs/chat-hooks`) SHALL build the `createOptions` array of `DropdownItem` entries that `apps/chat/src/components/CatalogView/CatalogView.tsx` passes to `Catalog`. The hook owns the menu's state (the search query) and its ordering; `CatalogView` supplies the schemas, the feature flags, the translated labels and the editor-URL builders.

The menu SHALL contain:

| Key | Label | Gate | Destination |
|---|---|---|---|
| `runner:<schemaId>` — one per runner schema | the schema's `displayName`, else its id | `OverlayFeature.SchemaApps` on **and** `OverlayFeature.HideCustomAppCreation` off | `/apps-editor`, via `buildQuickAppCreateUrl(schemaId)` |
| `toolset` | `CatalogI18nKeys.CreateToolset` | `OverlayFeature.Toolsets` on | `ROUTES.ToolsetEditor` |
| `custom-app` | `CatalogI18nKeys.CreateCustomApp` | `OverlayFeature.CustomApps` on **and** `OverlayFeature.HideCustomAppCreation` off | `ROUTES.CustomAppEditor` |
| `skill` | `CatalogI18nKeys.CreateSkill` | always | submenu, see below |
| `prompt` | `CatalogI18nKeys.CreatePrompt` | `OverlayFeature.Prompts` on | `ROUTES.PromptEditor` |

The entries SHALL be grouped into two sections, in this order:

1. the **entity section** — `toolset`, `skill` and `prompt`;
2. the **runner section** — `custom-app` and every `runner:*` entry.

Within each section the entries SHALL be sorted by label with `localeCompare(…, { sensitivity: 'base' })`, so case does not affect the order. There is no cap on the number of runner options.

When both sections hold at least one entry after gating and search filtering, the hook SHALL insert between them, in this order, a `DropdownItemType.Divider` item keyed `create-sections-divider` and a `DropdownItemType.PlainText` item keyed `runners-header` whose label is `CatalogEditNavigationLabels.createRunners`. When either section is empty, neither item SHALL be present and the remaining entries form a single list.

Only runner options route into `/apps-editor`. Toolsets, custom apps, skills, and prompts each have their own editor route and are **not** schema-driven.

The `skill` entry SHALL be a submenu rather than a direct action, with two children: `skill-write-instructions`, navigating to `ROUTES.SkillEditor`, and `skill-upload`, which opens the skill-archive file picker instead of navigating.

Every navigating option other than the runners SHALL navigate to its bare editor route with no query parameters; the editors return to their own fixed route on cancel or save.

**Feature flags**: `OverlayFeature.SchemaApps`, `HideCustomAppCreation`, `Toolsets`, `CustomApps` and `Prompts` gate this menu. `HideCustomAppCreation` is an inverted gate: when on, it removes every runner option and the custom-app option, and with them the runner section.

**i18n impact**: runner labels come from the schema data, not translation keys. The runner-section header uses `catalog.create.runners` (`CatalogI18nKeys.CreateRunners`, "Runners"), passed to the hook as `CatalogEditNavigationLabels.createRunners`. The other labels use existing `CatalogI18nKeys` members.

**RTL / UI impact**: none beyond `CreateButton` and `CreateMenuSheet`. The divider and header are direction-agnostic and use logical spacing.

**Memoisation**: `createOptions` SHALL be wrapped in `useMemo` over the search query, the resolved runner schemas, the navigate function, the URL builders, the labels, the archive-picker trigger and every gating flag it reads. The runner schemas SHALL be memoised on `schemas`.

**Accessibility**: `CreateButton` from `@epam/ai-dial-catalog` handles its own ARIA. The divider SHALL render with `role="separator"`, and the header SHALL be neither a `menuitem` nor focusable, so arrow-key navigation moves only between options. No additional attributes are required in `CatalogView`.

#### Scenario: A disabled feature removes only its own option

- **WHEN** `OverlayFeature.Toolsets` is off and every other gate passes
- **THEN** `createOptions` contains no `toolset` entry and every other entry is unaffected

#### Scenario: HideCustomAppCreation removes the runners and the custom-app option

- **WHEN** `OverlayFeature.HideCustomAppCreation` is on
- **THEN** no `runner:*` entry, no `custom-app` entry, no `create-sections-divider` and no `runners-header` is present, regardless of the `SchemaApps` and `CustomApps` flags

#### Scenario: The skill option is always offered

- **WHEN** the create menu is built with every other gate off
- **THEN** the `skill` entry is still present, with its two children

#### Scenario: Uploading a skill archive does not navigate

- **WHEN** the user activates the `skill-upload` child
- **THEN** the skill-archive file picker opens and no navigation occurs

#### Scenario: Non-runner editors are opened without query parameters

- **WHEN** the user activates the `toolset`, `custom-app`, `skill-write-instructions`, or `prompt` entry
- **THEN** the router navigates to that entry's own editor route with no query string

#### Scenario: Entity options come first, then the runner section under a header

- **WHEN** the runners are "Quick app 2.0", "DIAL Loop" and "External app", and Toolset, Custom App, Skill and Prompt are enabled with labels "Toolset", "Custom App", "Skill", "Prompt"
- **THEN** the `createOptions` keys are, in order, `prompt`, `skill`, `toolset`, `create-sections-divider`, `runners-header`, `custom-app`, `runner:<DIAL Loop>`, `runner:<External app>`, `runner:<Quick app 2.0>`
- **AND** `runners-header` has the label passed as `labels.createRunners`

#### Scenario: Only one non-empty section renders without a header

- **WHEN** runner creation is enabled but Toolsets and Prompts are off and the search query is "loop", matching only the "DIAL Loop" runner
- **THEN** `createOptions` holds only `runner:<DIAL Loop>`, with no `create-sections-divider` and no `runners-header`

---

### Requirement: The Quick App option resolves its schema and navigates through a shared editor-URL builder

`getRunnerSchemas(schemas)` (`libs/chat-hooks/src/shared/application-schema.ts`) SHALL return the runner schemas from `useDeployments().schemas`: one entry per distinct `id`, keeping the first occurrence, with entries that have no `id` and the `custom_app` schema (`isCustomAppSchema`) removed. It applies no other filter — a runner is offered whether or not it has an `editorUrl`, a `schemaEndpoint`, or declared properties. `useCatalogEditNavigation` SHALL build one `runner:<id>` option per returned schema.

"Quick app" and "Quick app 2.0" are distinct schemas and SHALL appear as two options, each labelled with its own `displayName`. No option label is substituted from a translation key.

Navigation SHALL go through the host-supplied `CatalogEditNavigationUrls` builders — `buildQuickAppCreateUrl(schemaId)` and `buildQuickAppEditUrl(schemaId, appId)` — rather than a hand-written query string, so create and edit cannot drift apart. `CatalogView` implements them against `ROUTES.AppsEditor`; the lib knows no route or query key. For a runner option `buildQuickAppCreateUrl` is called with that runner's schema id, producing:

```
/apps-editor?schema=<encoded schemaId>
```

Both builders SHALL set the `schema` parameter; only `buildQuickAppEditUrl` adds `appId`, whose presence is what puts the editor in edit mode. No `step` or `isCreating` parameter is written. The schema id is passed whole, with no stripping. `URLSearchParams` does the encoding.

While schemas are still loading, `schemas` is empty and no runner option is offered; the options appear once the list arrives.

#### Scenario: One option per distinct runner

- **WHEN** `schemas` contains `mind-map` twice, `quickapps2`, `custom_app`, and an entry with no `id`
- **THEN** `createOptions` contains exactly `runner:mind-map` and `runner:quickapps2` among the runner options

#### Scenario: Quick app and Quick app 2.0 are both listed by name

- **WHEN** `schemas` contains a schema with `displayName` "Quick app" and another with "Quick app 2.0"
- **THEN** the menu shows two runner options labelled "Quick app" and "Quick app 2.0"

#### Scenario: A runner with no editor, endpoint, or properties is still offered

- **WHEN** a schema has an `id` but no `editorUrl`, no `schemaEndpoint`, and no properties
- **THEN** its runner option is present

#### Scenario: Choosing a runner opens apps-editor for that schema

- **WHEN** the user activates the `runner:mind-map` option
- **THEN** the router navigates to `/apps-editor` with `schema=mind-map` and no `appId`, `step` or `isCreating`

#### Scenario: No runner option while schemas are loading

- **WHEN** `schemas` is still empty
- **THEN** `createOptions` contains no `runner:*` entry

#### Scenario: The edit action reuses the same builder

- **WHEN** the catalog opens an existing runner app for editing
- **THEN** it calls `buildQuickAppEditUrl` with the app's schema id and its id

### Requirement: The Create menu is also offered narrowed to each entity type

Alongside `createOptions`, `useCatalogEditNavigation` SHALL return `createMenuByType: Partial<Record<CatalogEntityType, CatalogTabCreateMenu>>`, where `CatalogTabCreateMenu` (`{ options: DropdownItem[]; search?: CatalogCreateSearch }`, exported from `@epam/ai-dial-catalog`) is the Create menu restricted to one entity type. It is built from the same gated, search-filtered options as `createOptions`, so every gate and the search query apply identically:

| Type | `options` | `search` |
|---|---|---|
| `CatalogEntityType.Agent` | the `runner:*` options plus `custom-app`, sorted by label as in `createOptions` | `createSearch` |
| `CatalogEntityType.Toolset` | `toolset`, or none | — |
| `CatalogEntityType.Skill` | the `skill` group's visible children (`skill-write-instructions`, `skill-upload`), flattened — no `skill` parent | — |
| `CatalogEntityType.Prompt` | `prompt`, or none | — |

`CatalogEntityType.Model` SHALL have no entry, because models are never created from the catalog. A type whose gate is off keeps its entry with an empty `options` array, so the host can still tell "creatable type, nothing enabled" from "not creatable at all".

`CatalogView` SHALL pass `createMenuByType` to `Catalog` as `createMenuByTab`, which uses it only for the personal empty state (see `catalog-personal-empty-state`); the header Create button keeps the full `createOptions` menu.

#### Scenario: The menu is split by entity type and models get no entry

- **WHEN** runners, Toolset, Custom App and Prompt are all enabled
- **THEN** `createMenuByType` has entries for Agent (runners and `custom-app`), Toolset (`toolset`), Skill (`skill-write-instructions`, `skill-upload`) and Prompt (`prompt`), and no entry for Model

#### Scenario: The agent menu carries the runner search

- **WHEN** runner options are offered
- **THEN** the Agent entry's `search` is the same `createSearch` the full menu uses, and no other entry has a `search`

#### Scenario: A disabled type keeps an empty entry

- **WHEN** `OverlayFeature.Toolsets` is off
- **THEN** the Toolset entry is present with an empty `options` array

---

### Requirement: The Create menu is searchable while it offers runners

`useCatalogEditNavigation` SHALL own the Create menu's search query and return `createSearch: CatalogCreateSearch | undefined` (`{ value: string; onChange: (value: string) => void }`, exported from `@epam/ai-dial-catalog`). It SHALL be defined only while runner options are enabled (`SchemaApps` on, `HideCustomAppCreation` off) and at least one runner schema exists; otherwise it is `undefined` and `CreateButton` renders the plain split-chevron dropdown.

The query SHALL be trimmed and matched case-insensitively as a substring of each option's label:

- runner, toolset, custom-app and prompt options are kept only when their label matches;
- the `skill` group is kept with both children when "Skill" matches, otherwise with only its matching children, and is dropped when neither the group nor a child matches;
- the `runners-header` label is never matched against the query; the header and the divider are kept only while both sections still hold an option (see the create-menu requirement).

`CatalogView` SHALL pass `createSearch` to `Catalog`, whose `createSearch` prop forwards it to `CreateButton`, together with translated `titles.createSearchPlaceholder` (`basic.searchPlaceholder`), `titles.createSearchClearLabel` (`basic.clearSearch`) and `titles.createNoResultsLabel` (`basic.noResults`). The lib defaults are `'Search'`, `'Clear search'` and `'No results found'`.

`CreateButton` SHALL render, when `search` is provided:

- the kit `Search` (small) in the dropdown's `menuHeader`, named by the placeholder (`aria-label`), on an opaque `bg-layer-raised` row that sticks at `-top-1`, so it also covers the panel's 4px inset and no scrolled option shows above or behind it;
- every string label of a `DropdownItemType.Item` option, nested labels included, through the kit `Highlight` for the current query with `maxLines={1}` — one line, ellipsis, tooltip on overflow. `highlightDropdownLabels` (`libs/catalog/src/utils/create-menu.tsx`) SHALL return `Divider` and `PlainText` items unchanged;
- a single `DropdownItemType.PlainText` row wrapping the no-results label in `role="status"` when the filtered list is empty;
- a reset of the query to `''` whenever the menu closes.

#### Scenario: The query narrows every kind of option

- **WHEN** the runners are "Mind map" and "OCR" and the user types "MAP"
- **THEN** the only option left is `runner:mind-map`

#### Scenario: A query can reach a skill child

- **WHEN** the user types "upload"
- **THEN** the menu shows only the `skill` group, containing only `skill-upload`, with no divider and no header

#### Scenario: Matches are highlighted

- **WHEN** the user types "oc" and "OCR" is an option
- **THEN** the "OC" part of its label is wrapped in a `mark` element

#### Scenario: The section header is not highlighted

- **WHEN** Prompt is enabled, "OCR" is a runner, and the user types "r", so both "Prompt" and "OCR" still match
- **THEN** the "Runners" header is shown and its text contains no `mark` element, while "Prompt" and "OCR" each have their "r" wrapped in `mark`

#### Scenario: An empty result is announced

- **WHEN** the query matches no option
- **THEN** the menu shows the no-results label inside a `role="status"` element, and no divider or header

#### Scenario: Closing the menu clears the query

- **WHEN** the user types a query and then closes the menu with Escape
- **THEN** `createSearch.onChange` is called with `''`

#### Scenario: No search without runners

- **WHEN** no runner schema exists, or `OverlayFeature.SchemaApps` is off
- **THEN** `createSearch` is `undefined` and the menu has no search field

### Requirement: The searchable Create menu keeps a fixed size and scrolls

When `CreateButton` renders the searchable menu, the kit `Dropdown` SHALL receive:

- `listClassName` set to `CREATE_MENU_LIST_CLASS_NAME` (`'w-[320px]'`) and `matchReferenceWidth={false}`, so the panel's width does not change as the query changes the longest visible label; the kit still caps it at the viewport's available width;
- `placement="bottom-end"`, anchoring the panel to the button's end edge (logical, so it mirrors under `dir="rtl"`);
- `maxVisibleItems` set to `CREATE_MENU_VISIBLE_ROWS` (7), so up to seven options are visible and the item list scrolls beyond that under the search field. The kit derives the height from its own row geometry.

Both constants live in `libs/catalog/src/constants/create-menu.ts`.

#### Scenario: Filtering does not resize the panel

- **WHEN** the user types a query that removes the longest option
- **THEN** the panel keeps its 320px width

#### Scenario: Long lists scroll with the search in view

- **WHEN** the menu holds more than seven options
- **THEN** the item list shows seven rows and scrolls, and the search row stays above it

#### Scenario: A long runner name stays on one line

- **WHEN** a runner is named "OpenAPI 2 MCP Runner curiously-first-sheep.ngrok-free.app"
- **THEN** its option shows one truncated line with an ellipsis and the full name in a tooltip
