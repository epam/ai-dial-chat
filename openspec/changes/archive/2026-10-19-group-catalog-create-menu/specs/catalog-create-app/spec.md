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
