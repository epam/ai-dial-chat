## Context

`useCatalogEditNavigation` (`libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts`) builds the catalog's Create menu. `createMenuParts` produces `runnerOptions`, `toolsetOption`, `customAppOption`, `visibleSkillChildren`, and `promptOption`, each already gated and search-filtered. `createOptions` then concatenates them and runs `sortByLabel`, giving one alphabetical list. `CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) passes that list to `Catalog`, which forwards it to `CreateButton` (`libs/catalog/src/components/Catalog/CreateButton.tsx`). `CreateButton` renders it in one of three ways:

- the kit `Dropdown` with a search header (when `createSearch` is defined);
- the kit `ButtonDropdown` (options without search);
- `CreateMenuSheet` below the desktop breakpoint.

The kit `Dropdown` already supports `DropdownItemType.Divider` (rendered as `role="separator"`) and `DropdownItemType.PlainText` (a non-interactive caption row that is not a `menuitem` and is not reached by arrow navigation). Two catalog-side helpers do not handle these types:

- `highlightDropdownLabels` (`libs/catalog/src/utils/create-menu.tsx`) wraps every string label in `Highlight`, including a plain-text header's.
- `CreateMenuSheet` drops `PlainText` items and would render a `Divider` as an empty `MenuItem`.

## Goals / Non-Goals

**Goals:**

- Separate the fixed entity options from the runner options in the general Create menu with a divider and a translated "Runners" header.
- Keep search, gating, the no-results state, and the per-tab menus behaving as they do today.
- Render the sections correctly in the desktop dropdown and in the mobile bottom sheet.

**Non-Goals:**

- Classifying runner schemas (platform vs. other). See the proposal.
- Any backend, OpenAPI, or feature-flag change.

## Decisions

### D1. Sections are built in the hook from kit `DropdownItem` types

`createOptions` is assembled as follows:

```
entitySection = sortByLabel([toolset?, skill-group?, prompt?])
runnerSection = sortByLabel([custom-app?, ...runner:*])
both non-empty → [...entitySection, divider, header, ...runnerSection]
otherwise      → [...entitySection, ...runnerSection]   (one of them is empty)
```

The keys are `create-sections-divider` (`type: DropdownItemType.Divider`) and `runners-header` (`type: DropdownItemType.PlainText`, `label: labels.createRunners`).

*Why in the hook:* the hook already owns ordering and filtering (spec `catalog-create-app`), and the result stays a plain `DropdownItem[]`, so the `Catalog` / `CreateButton` prop contract does not change.

*Alternative:* add a `sections` prop to `CreateButton`. Rejected: it widens the lib's public API and duplicates what the kit item types already express.

### D2. Custom App belongs to the runner section

The issue lists "Custom App" among the runner types, and the per-tab Agents menu already groups `custom-app` with `runner:*`. The entity section is therefore Toolset, Skill, and Prompt.

### D3. Each section keeps the existing label sort

Each section uses `sortByLabel` (`localeCompare`, `sensitivity: 'base'`). A fixed Toolset/Skill/Prompt order was considered, but sorting stays consistent with today's rule and with every locale.

### D4. Header and divider appear only between two non-empty sections

When gating or the search query empties one section, the remaining options render flat with no header. A header over an empty list, or a dangling divider, would be noise. When both sections are empty, `createOptions` is `[]` and `CreateButton` shows its existing no-results row.

### D5. Catalog helpers skip non-item rows

- `highlightDropdownLabels` returns `Divider` / `PlainText` items unchanged. The header text never matches the user's query visually, and the no-results row is built by `CreateButton` after highlighting, so it is unaffected.
- `CreateMenuSheet` renders:
  - `Divider` as `<div role="separator">`;
  - `PlainText` as a non-interactive caption.

  Their colors come from `CreateMenuSheet.module.scss` through CSS custom properties with theme-token fallbacks: `--cat-create-menu-divider` → `--stroke-tertiary`, and `--cat-create-menu-section-header-text` → `--text-secondary`. Hosts override them via `CatalogColors.createMenu` (`CreateMenuColors`), which `Catalog` threads through `CreateButton` to the sheet's `buildCssVars` call. The vars are set on the sheet's own menu element, because `BottomSheet` renders in a portal outside the catalog root's vars. The header's typography is `CatalogTypography.createMenuSectionHeaderClassName` (default `'dial-caption-text'`). Only `Item` rows become `MenuItem role="menuitem"`. Tests rely on the `role="separator"` and on the absence of a header `menuitem`; no `data-testid` is used.

### D6. Lib isolation

`chat-hooks` receives the header text through `CatalogEditNavigationLabels.createRunners`, resolved by `CatalogView` with `t(CatalogI18nKeys.CreateRunners)`. `catalog` only learns to render kit item types it already accepts. No routing, i18n, flags, or DIAL Core knowledge moves into either lib.

### D7. Memoisation

`createOptions` stays a single `useMemo`. Its dependency list gains `labels.createRunners`, which is already covered by `labels`. There is no new state.

## Risks / Trade-offs

- [`CatalogEditNavigationLabels` gains a required field → external hosts that call the hook fail type-checking] → The only in-repo caller is updated in the same change, and the README example is updated. All libs ship at `0.0.1`, so there is no semver signal to bump.
- [The kit `ButtonDropdown` (no-search path) may not forward `Divider` / `PlainText` the way `Dropdown` does] → Cover it with a `CreateButton.spec.tsx` case that renders options with a divider and no `search`. If the kit drops them, fall back to rendering that path through `Dropdown` in `CreateButton` (same visual) rather than patching the kit.
- [The header row sits inside the scroll area, so it scrolls away in a long list] → Accepted. A sticky sub-header would collide with the sticky search row, and `CREATE_MENU_MAX_HEIGHT_PX` already keeps seven rows visible.
- [The visible-row count for `CREATE_MENU_MAX_HEIGHT_PX` was computed for 40px item rows; the header and divider are shorter] → No constant change. The panel still caps at 344px and scrolls.

## Migration Plan

No data migration and no feature flag. The change ships as one commit and is reverted with one commit.

## Open Questions

- Should the header text be "Runners" or "Agents" to match the catalog tab name? The default is "Runners", which matches the issue's wording. Confirm with the issue author during review.
