## Why

Issue #9335: the catalog's general Create menu is one flat alphabetical list. Every application-type schema DIAL Core returns becomes a `runner:*` option, and `useCatalogEditNavigation` sorts those runners together with the fixed entity options (Toolset, Custom App, Skill, Prompt) by label (`sortByLabel` in `libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts`). On environments with many schemas ("CodeApps", "DIAL Loop", "External app", "Debate Sentiment", "EntityExtractor", "MCP DEBUG …"), the few fixed entity types are buried among the runners and are easy to miss.

## Problem

- `createOptions` interleaves runner schemas with Toolset / Custom App / Skill / Prompt alphabetically (required today by `catalog-create-app`, "Runners and static options interleave alphabetically", and by `catalog-create-options`, "Prompt is placed alphabetically").
- The number of runners is unbounded and set by the environment, so where the fixed options land is unpredictable.

## Solution

Split the general Create menu into two sections built from the kit's own `DropdownItem` types:

1. **Entity section** (first): Toolset, Skill (submenu), and Prompt, each behind its existing gate, sorted by label among themselves.
2. A `DropdownItemType.Divider`, then a `DropdownItemType.PlainText` section header labelled "Runners", then the **runner section**: Custom App plus every `runner:*` option, sorted by label.

The header and divider are shown only when both sections have at least one option after gating and search filtering. With one empty section the menu stays a single flat list with no header. When the search leaves nothing, the existing `role="status"` no-results row is shown unchanged.

The mobile `CreateMenuSheet` and the desktop `Dropdown` / `ButtonDropdown` must render the divider and header as non-interactive rows. Search highlighting must not wrap the header.

The per-tab menus (`createMenuByType`) are **unchanged**: each tab already holds a single kind of entity.

## Non-goals

- Telling "platform" runners (CodeApps, DIAL Loop, External app) apart from other registered schemas (Debate Sentiment, …). DIAL Core exposes no type/capability field for schemas (see the TODO in `libs/chat-hooks/src/shared/application-schema.ts`). A config allowlist or a DIAL Core field is a separate follow-up.
- Changing the gates, labels, or destinations of any option.
- Changing the per-tab Create menus, the Create button's sizing, or the search matching rules.

## Alternatives considered

- **Keep the flat list and pin the entity options on top without a header** (conservative baseline). Cheaper, but nothing tells the user where the fixed options end and the runner list begins. Rejected because a visible boundary is what the issue asks for.
- **Group by a runner classification (allowlist env var / DIAL Core field)**. Answers a different question (platform vs. other schemas), needs a backend DTO and OpenAPI change, and does not fix the entity-vs-runner mixing. Deferred to a follow-up.
- **Move runners into a "Runners ›" submenu**. Hides the most common creation path one level deeper, and doesn't fit how the search filters across all options. Rejected.

## What Changes

- `useCatalogEditNavigation`: `createOptions` becomes entity section → divider → "Runners" header → runner section, with each section sorted by label. Empty sections and their divider/header are dropped.
- `CatalogEditNavigationLabels` gains a required `createRunners` field (the section header text). **BREAKING** for direct callers of the hook's TypeScript interface. The only in-repo caller is `apps/chat/src/components/CatalogView/CatalogView.tsx`.
- New i18n key `catalog.create.runners` ("Runners") in `apps/chat/src/i18n/locales/en.json`, with a matching `CatalogI18nKeys.CreateRunners` member.
- `libs/catalog`: `highlightDropdownLabels` (`libs/catalog/src/utils/create-menu.tsx`) leaves `Divider` / `PlainText` items untouched. `CreateMenuSheet` renders a divider as a separator and a plain-text item as a non-interactive section label, instead of dropping it or rendering it as a `menuitem`.
- Specs `catalog-create-app` and `catalog-create-options` drop the "interleave alphabetically" ordering in favour of the sectioned order.
- READMEs: `libs/chat-hooks/README.md` (the `createOptions` row and the `labels` example) and `libs/catalog/README.md` if it describes the sheet's handling of item types.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `catalog-create-app`: the general Create menu's ordering changes from one alphabetical list to an entity section and a runner section with a divider and header; the search requirement adds rules for empty sections and highlighting.
- `catalog-create-options`: the Prompt entry no longer "takes its place in the alphabetical order of the whole menu", and the mobile bottom sheet must render the divider and section header.

## Impact

- **Code**: `libs/chat-hooks/src/catalog/useCatalogEditNavigation/useCatalogEditNavigation.ts`, `libs/catalog/src/utils/create-menu.tsx`, `libs/catalog/src/components/Catalog/CreateMenuSheet.tsx`, `apps/chat/src/components/CatalogView/CatalogView.tsx`, `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- **Tests**: `libs/chat-hooks/src/catalog/useCatalogEditNavigation/tests/useCatalogEditNavigation.spec.ts`, `libs/catalog/src/components/Catalog/tests/CreateButton.spec.tsx`, `libs/catalog/src/components/Catalog/tests/CreateButton.mobile.spec.tsx`.
- **Shared libs touched**: `chat-hooks` and `catalog`. Lib isolation holds: the hook still receives the translated header text through `labels` from the host and builds only generic `DropdownItem`s. `catalog` only learns to render kit item types it already accepts. No routing, i18n, or DIAL Core knowledge enters either lib.
- **i18n**: one new user-visible string, `catalog.create.runners`.
- **RTL**: none. The divider and header use logical spacing, and no directional icons are added.
- **a11y**: the header is a non-focusable, non-`menuitem` row; the divider is a `separator`. Keyboard arrow navigation skips both.
- **Rollback**: not breaking for end users and no data or contract migration. Reverting the commit restores the flat list. The `labels` field addition is source-compatible for the app, which is updated in the same change.

## Acceptance criteria

- With runners, Toolset, Custom App, Skill, and Prompt all enabled, the general Create menu shows Prompt / Skill / Toolset (by label), a divider, a "Runners" header, then Custom App and the runners by label.
- A search that matches only runners shows the runner options without the header or divider. A search that matches only Skill children shows only the Skill group. A search that matches nothing shows the no-results status.
- With runner creation disabled (`HideCustomAppCreation` on or `SchemaApps`/`CustomApps` off so the section is empty), no divider or header is rendered.
- On a 375px viewport, the bottom sheet shows the same sections. The header is not tappable and keeps no focus, and the divider is a `separator`.
- The per-tab Create menus are byte-for-byte the same as before.
- `npm run validate:docs` and `npm run validate:specs` pass, and the hook and CreateButton tests cover the cases above.
