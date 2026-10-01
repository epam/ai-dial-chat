## MODIFIED Requirements

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

All entries SHALL be sorted together by label with `localeCompare(…, { sensitivity: 'base' })`, so runners and static options interleave alphabetically and case does not affect the order. There is no fixed order and no cap on the number of runner options.

Only runner options route into `/apps-editor`. Toolsets, custom apps, skills, and prompts each have their own editor route and are **not** schema-driven.

The `skill` entry SHALL be a submenu rather than a direct action, with two children: `skill-write-instructions`, navigating to `ROUTES.SkillEditor`, and `skill-upload`, which opens the skill-archive file picker instead of navigating.

Every navigating option other than the runners SHALL navigate to its bare editor route with no query parameters; the editors return to their own fixed route on cancel or save.

**Feature flags**: `OverlayFeature.SchemaApps`, `HideCustomAppCreation`, `Toolsets`, `CustomApps` and `Prompts` gate this menu. `HideCustomAppCreation` is an inverted gate: when on, it removes every runner option and the custom-app option.

**i18n impact**: runner labels come from the schema data, not translation keys. `catalog.create.quickApp` (`CatalogI18nKeys.CreateQuickApp`) and `CatalogEditNavigationLabels.createQuickApp` are removed. The other labels use existing `CatalogI18nKeys` members.

**RTL / UI impact**: none beyond `CreateButton` (see the searchable-menu requirement).

**Memoisation**: `createOptions` SHALL be wrapped in `useMemo` over the search query, the resolved runner schemas, the navigate function, the URL builders, the labels, the archive-picker trigger and every gating flag it reads. The runner schemas SHALL be memoised on `schemas`.

**Accessibility**: `CreateButton` from `@epam/ai-dial-catalog` handles its own ARIA. No additional attributes are required in `CatalogView`.

#### Scenario: A disabled feature removes only its own option

- **WHEN** `OverlayFeature.Toolsets` is off and every other gate passes
- **THEN** `createOptions` contains no `toolset` entry and every other entry is unaffected

#### Scenario: HideCustomAppCreation removes the runners and the custom-app option

- **WHEN** `OverlayFeature.HideCustomAppCreation` is on
- **THEN** no `runner:*` entry and no `custom-app` entry is present, regardless of the `SchemaApps` and `CustomApps` flags

#### Scenario: The skill option is always offered

- **WHEN** the create menu is built with every other gate off
- **THEN** the `skill` entry is still present, with its two children

#### Scenario: Uploading a skill archive does not navigate

- **WHEN** the user activates the `skill-upload` child
- **THEN** the skill-archive file picker opens and no navigation occurs

#### Scenario: Non-runner editors are opened without query parameters

- **WHEN** the user activates the `toolset`, `custom-app`, `skill-write-instructions`, or `prompt` entry
- **THEN** the router navigates to that entry's own editor route with no query string

#### Scenario: Runners and static options interleave alphabetically

- **WHEN** the runners are "Mind Map", "Quick app" and "Quick app 2.0", and Toolset, Custom App, Skill and Prompt are enabled with labels "Create toolset", "Create custom app", "Skill", "Create prompt"
- **THEN** the options are ordered "Create custom app", "Create prompt", "Create toolset", "Mind Map", "Quick app", "Quick app 2.0", "Skill"

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

## ADDED Requirements

### Requirement: The Create menu is searchable while it offers runners

`useCatalogEditNavigation` SHALL own the Create menu's search query and return `createSearch: CatalogCreateSearch | undefined` (`{ value: string; onChange: (value: string) => void }`, exported from `@epam/ai-dial-catalog`). It SHALL be defined only while runner options are enabled (`SchemaApps` on, `HideCustomAppCreation` off) and at least one runner schema exists; otherwise it is `undefined` and `CreateButton` renders the plain split-chevron dropdown.

The query SHALL be trimmed and matched case-insensitively as a substring of each option's label:

- runner, toolset, custom-app and prompt options are kept only when their label matches;
- the `skill` group is kept with both children when "Skill" matches, otherwise with only its matching children, and is dropped when neither the group nor a child matches.

`CatalogView` SHALL pass `createSearch` to `Catalog`, whose `createSearch` prop forwards it to `CreateButton`, together with translated `titles.createSearchPlaceholder` (`basic.searchPlaceholder`), `titles.createSearchClearLabel` (`basic.clearSearch`) and `titles.createNoResultsLabel` (`basic.noResults`). The lib defaults are `'Search'`, `'Clear search'` and `'No results found'`. No new translation key is introduced.

`CreateButton` SHALL render, when `search` is provided:

- the kit `Search` (small) in the dropdown's `menuHeader`, named by the placeholder (`aria-label`), on an opaque `bg-layer-raised` row that sticks at `-top-1`, so it also covers the panel's 4px inset and no scrolled option shows above or behind it;
- every string option label, nested labels included, through the kit `Highlight` for the current query with `maxLines={1}` — one line, ellipsis, tooltip on overflow;
- a single `DropdownItemType.PlainText` row wrapping the no-results label in `role="status"` when the filtered list is empty;
- a reset of the query to `''` whenever the menu closes.

#### Scenario: The query narrows every kind of option

- **WHEN** the runners are "Mind map" and "OCR" and the user types "MAP"
- **THEN** the only option left is `runner:mind-map`

#### Scenario: A query can reach a skill child

- **WHEN** the user types "upload"
- **THEN** the menu shows only the `skill` group, containing only `skill-upload`

#### Scenario: Matches are highlighted

- **WHEN** the user types "oc" and "OCR" is an option
- **THEN** the "OC" part of its label is wrapped in a `mark` element

#### Scenario: An empty result is announced

- **WHEN** the query matches no option
- **THEN** the menu shows the no-results label inside a `role="status"` element

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
- `maxDropdownHeight` set to `CREATE_MENU_MAX_HEIGHT_PX` — the 44px search row, 8px of insets and seven 40px rows 2px apart (344px) — so up to seven options are visible and the panel scrolls beyond that while the sticky search row stays in view.

Both constants live in `libs/catalog/src/constants/create-menu.ts` and mirror the kit's overlay row geometry.

#### Scenario: Filtering does not resize the panel

- **WHEN** the user types a query that removes the longest option
- **THEN** the panel keeps its 320px width

#### Scenario: Long lists scroll with the search in view

- **WHEN** the menu holds more than seven options
- **THEN** the panel is 344px tall, scrolls, and the search row stays at its top

#### Scenario: A long runner name stays on one line

- **WHEN** a runner is named "OpenAPI 2 MCP Runner curiously-first-sheep.ngrok-free.app"
- **THEN** its option shows one truncated line with an ellipsis and the full name in a tooltip
