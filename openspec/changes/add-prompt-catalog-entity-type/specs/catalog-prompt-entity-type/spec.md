## ADDED Requirements

### Requirement: `CatalogEntityType` gains a `Prompt` member

`libs/catalog/src/types/entity-type.ts` SHALL add `Prompt = 'PROMPT'` to the `CatalogEntityType` enum. The member SHALL be exported from `libs/catalog/src/index.ts` (it already is, via the existing `export { CatalogEntityType }`).

`libs/catalog/src/constants/entity-colors.ts` SHALL add an `ENTITY_TYPE_COLOR` entry for `Prompt`. Because `ENTITY_TYPE_COLOR` is typed `Record<CatalogEntityType, string>`, omitting it MUST be a compile error, not a runtime fallback.

The lib MUST NOT branch on `Prompt` to reach any host-owned fact. It MUST NOT import i18n, read a feature flag, construct an endpoint path, or reference `@epam/ai-dial-chat-api-client`. `Prompt` is a display category only.

#### Scenario: Entity type label renders for a prompt item

- **WHEN** `EntityTypeLabel` is rendered with `type={CatalogEntityType.Prompt}`
- **THEN** it renders the text `PROMPT` in uppercase
- **AND** its `--entity-color` CSS custom property resolves to the `Prompt` entry of `ENTITY_TYPE_COLOR`

#### Scenario: Prompt colour is exhaustively required

- **WHEN** a developer adds `Prompt` to `CatalogEntityType` without adding an `ENTITY_TYPE_COLOR` entry
- **THEN** `npm exec nx build catalog` fails with a TypeScript error on the `Record<CatalogEntityType, string>` map

#### Scenario: Existing entity types are unaffected

- **WHEN** the catalog renders items of type `Model`, `Agent`, `Toolset`, or `Skill`
- **THEN** their labels, colours, cards, and list rows are identical to before this change

---

### Requirement: `Prompt` has a tab label and a canonical tab position

`buildCatalogTabs` (`libs/catalog/src/utils/catalog-tabs.ts`) SHALL add `Prompt` to `DEFAULT_TAB_LABELS` with the English default `'Prompts'`, and to `TAB_ORDER` immediately after `CatalogEntityType.Toolset`.

Tab derivation behaviour is unchanged: a tab appears only when at least one item of that type is present in `items`, and a host-supplied `tabLabels[CatalogEntityType.Prompt]` overrides the English default.

#### Scenario: Prompts tab appears when prompt items are present

- **WHEN** `buildCatalogTabs` is called with items containing at least one `Prompt` item
- **THEN** the returned tabs include `{ id: 'PROMPT', label: 'Prompts' }`
- **AND** it is positioned after the Toolsets tab and before any Skill tab

#### Scenario: Prompts tab is absent when no prompt items exist

- **WHEN** `buildCatalogTabs` is called with items containing only Model and Agent items
- **THEN** the returned tabs contain no `PROMPT` entry

#### Scenario: Host label override wins

- **WHEN** `buildCatalogTabs` is called with prompt items and `tabLabels = { PROMPT: 'Подсказки' }`
- **THEN** the returned Prompts tab label is `'Подсказки'`

---

### Requirement: A prompt's body renders in a dedicated read-only Content details tab

`libs/catalog/src/types/detail-tab.ts` SHALL add `Content = 'content'` to `CatalogDetailsTab`.

`libs/catalog/src/models/item-details-data.ts` SHALL add:

```ts
/** Complete data for the Content tab (long-form text entities such as prompts). */
export interface CatalogItemPromptContent {
  /** The item's full text body, already resolved by the host. */
  content: string;
}
```

and an optional `promptContent?: CatalogItemPromptContent` field on `CatalogItemTabData`. `CatalogItemPromptContent` SHALL be exported from `index.ts`, since it is reachable through the public `CatalogItemTabData` / `CatalogItemDetailsFetchResult` types.

`DetailsPanel` SHALL render a `Content` tab when `details.promptContent` is non-null, and hide it when absent — the same gating rule already applied to `overview`, `pricing`, `limits`, `api`, and `tools`. It is positioned after `About` for types that have one, and **first** for a prompt, which has none. The tab body SHALL render the text read-only as markdown in a scrollable container (`overflow` on its own element, never on the page body). It carries no copy control: the body is selectable text, and a copy affordance duplicated what the platform already offers.

`ItemDetailsTexts` SHALL gain `tabContentLabel?: string` (default `'Details'`). No copy-related label is declared — an earlier revision added `copyContentAriaLabel` and `contentCopiedStatusLabel` for a copy button that has since been removed, and a label nothing reads is dead public API.

The panel SHALL open on whichever tab is first for the displayed item, resolved from the item's own tab set rather than from a hardcoded tab id — `About` does not exist for every type, so naming it as the initial tab would select a tab that is not there.

The tab body MUST use logical CSS properties (`ps-*`/`pe-*`, `text-start`) so it flips under `dir="rtl"`.

#### Scenario: Content tab is shown when promptContent is present

- **WHEN** the details panel opens for an item whose `details.promptContent` is `{ content: 'Summarize {{text}}' }`
- **THEN** the tab row contains a `Content` tab, after `About` for a type that has one and first for a prompt
- **AND** selecting it renders `Summarize {{text}}` read-only, with `{{text}}` highlighted

#### Scenario: Content tab is hidden when promptContent is absent

- **WHEN** the details panel opens for an item whose `details.promptContent` is `undefined`
- **THEN** the tab row contains no `Content` tab

#### Scenario: The Content tab offers no copy control

- **WHEN** the Content tab renders a body
- **THEN** no button is rendered inside it
- **AND** no `aria-live` region is rendered, since there is no transient status left to announce

#### Scenario: Long content scrolls inside its own container

- **WHEN** the Content tab renders a 50 000-character body
- **THEN** the content container scrolls
- **AND** the details panel and page body do not scroll horizontally

---

### Requirement: `Prompt` joins the built-in primary-action default and stays out of the publish default

`libs/catalog/src/components/Details/Header/Header.tsx` currently defaults `shouldShowPrimaryAction` to `Model || Agent` and `shouldShowPublish` to `Model || Toolset || Agent` when the host supplies no predicate. `Prompt` SHALL be added to the primary-action default and SHALL NOT be added to the publish default.

Both host predicates (`isPrimaryActionVisible`, `isPublishVisible`) keep precedence over the defaults exactly as today; nothing about their contract changes.

#### Scenario: Prompt details panel shows the primary action by default

- **WHEN** the details panel opens for a `Prompt` item and no `isPrimaryActionVisible` predicate is supplied
- **THEN** the primary action button is rendered

#### Scenario: Prompt details panel has no Publish action by default

- **WHEN** the details panel opens for a `Prompt` item and no `isPublishVisible` predicate is supplied
- **THEN** the Manage menu contains no Publish entry

#### Scenario: Host predicate still overrides the Prompt default

- **WHEN** the details panel opens for a `Prompt` item and `isPrimaryActionVisible` returns `false`
- **THEN** the primary action button is not rendered

---

### Requirement: The unshare and revoke controls are suppressible per item by host predicate

`libs/catalog` SHALL add two optional host predicates so a host can declare that a sharing-removal action does not exist for a given item, without the lib knowing why:

- `isUnshareVisible?: (item: CatalogItem) => boolean`, combined (AND) with the lib's existing recipient-side rule `!!onUnshare && item.isMyApp !== true && item.sharedWithMe === true`.
- `isRevokeShareVisible?: (item: CatalogItem) => boolean`, combined (AND) with the lib's existing owner-side rule `!!onRevokeShare && item.isMyApp === true && (recipientsCount == null || recipientsCount > 0)`.

Both live on `CatalogProps` and `DetailsPanelProps` and are threaded to `Header`. Because each is ANDed with its built-in rule, a predicate can only ever narrow visibility — returning `true` MUST NOT surface an action the built-in rule hides.

Both SHALL default to "visible" when absent, so every existing host renders identically to today, and SHALL be documented with JSDoc stating that default.

No favourite-visibility predicate is added. An earlier revision of this change added `isFavoriteVisible` to hide the star for prompts; prompts are favouritable now (see `prompt-catalog-integration`), which left the predicate with no caller. A lib prop that no host passes is dead public API and SHALL NOT be retained: the star renders for every entity type, prompts included.

The revoke predicate was added late: `libs/catalog` gained the owner-side `onRevokeShare` action from `development-1.0` after this change was drafted, and without a predicate that action rendered on every personal prompt and failed with a 400 — see the Revoke access bullet in `prompt-catalog-integration`.

#### Scenario: Unshare action is hidden by predicate

- **WHEN** the details panel opens for an item with `sharedWithMe: true` and `onUnshare` supplied, and `isUnshareVisible` returns `false`
- **THEN** no "Remove from My List" action is rendered

#### Scenario: Revoke action is hidden by predicate

- **WHEN** the details panel opens for an item with `isMyApp: true` and `onRevokeShare` supplied, and `isRevokeShareVisible` returns `false`
- **THEN** no "Revoke access" action is rendered

#### Scenario: A predicate cannot widen visibility

- **WHEN** `isRevokeShareVisible` returns `true` for an item with `sharedWithMe: true`
- **THEN** no "Revoke access" action is rendered, because the built-in owner-side rule still excludes it

#### Scenario: The predicates are optional and additive

- **WHEN** an existing consumer of `Catalog` passes neither predicate
- **THEN** it compiles unchanged and every unshare and revoke control renders exactly as before

#### Scenario: The star renders for every entity type

- **WHEN** the catalog renders a card, a list row, and the details panel for a Prompt item
- **THEN** the star/favourite control is rendered in all three surfaces, exactly as it is for a Model item

---

### Requirement: A prompt's details panel shows exactly two tabs

`DetailsPanel` currently pushes the `About` tab unconditionally as the first tab. For `CatalogEntityType.Prompt` it SHALL be omitted, leaving `Content` (the body) followed by `Overview`, in that order.

The rationale is non-duplication, not capability: the `Content` tab renders the item's `description` above the body, and the storage metadata is carried by `Overview`, so an About tab would repeat them. Because this is a display rule rather than a host capability, it SHALL be a type check inside the lib — consistent with `ENTITY_TYPE_COLOR`, `TAB_ORDER`, and `Header`'s primary-action rule — and SHALL NOT add a host predicate.

The `Content` tab SHALL be labelled **Details** by default (`tabContentLabel`). Because it shows the description, `buildPromptOverview` MUST NOT also emit a description row.

Every other entity type SHALL keep the `About` tab exactly as before.

#### Scenario: A prompt with a body and overview data shows Details then Overview

- **WHEN** the details panel opens for a Prompt item whose `details` carry both `promptContent` and `overview`
- **THEN** the tab row contains exactly `Details` and `Overview`, in that order
- **AND** `Details` is the active tab, so the body is visible without a click
- **AND** no `About` tab is rendered
- **AND** the prompt body is shown by default, because `Content` is the first tab

#### Scenario: A prompt with no resolved body shows only Overview

- **WHEN** the details panel opens for a Prompt item whose `details` carry `overview` but no `promptContent`
- **THEN** no `Content` tab is rendered

#### Scenario: Other entity types keep About

- **WHEN** the details panel opens for a Model item
- **THEN** the `About` tab is rendered first, as before this change

---

### Requirement: The Content tab renders markdown with highlighted placeholders

The body SHALL be rendered as markdown through the shared `MarkdownRenderer`, not as preformatted text — a prompt body is authored with headings and lists, and rendering it verbatim loses that structure.

`MarkdownRenderer` SHALL gain an optional `rehypePlugins` prop, appended after its built-in KaTeX pass, mirroring the `components` escape hatch it already exposes. Consumers that pass nothing keep today's behaviour.

`rehypePromptVariables` (`libs/catalog/src/utils/prompt-variables.ts`) SHALL wrap every `{{name}}` token in a span so it can be coloured apart from the surrounding prose. It MUST:

- build hast element nodes directly rather than injecting raw HTML, so a token containing markup cannot escape into the document
- skip `code` and `pre` subtrees, where a placeholder is being shown as literal syntax
- require a non-empty inner run that contains no braces, so `{{}}` and an unclosed `{{` stay plain text and one stray brace pair cannot swallow the rest of the document

`Content.module.scss` SHALL colour `.cat-prompt-variable` from `var(--cat-details-variable-text, var(--text-prompt-parameter, #3730b7))`, and `ItemDetailsColors` SHALL declare a matching `variableText` field that `DetailsPanel`'s `buildCssVars` maps to `--cat-details-variable-text`. Both halves are required by the lib-styling contract: a stylesheet reading a variable nothing sets makes a host override silently inert, and a `buildCssVars` entry no stylesheet reads is dead API.

An earlier revision shipped the class name without a colour, on the reasoning that styling belonged to the host. That left placeholders indistinguishable from the surrounding prose in every host that did not know to add the rule, so the lib now carries the default and the host overrides it.

#### Scenario: A placeholder is highlighted

- **WHEN** the body contains `Reply to {{original_email}} politely.`
- **THEN** `{{original_email}}` is rendered in its own span carrying the placeholder class
- **AND** the surrounding text is unchanged

#### Scenario: A placeholder inside a code fence is left alone

- **WHEN** the body contains a fenced block whose content is `{{original_email}}`
- **THEN** no placeholder span is rendered

#### Scenario: Markdown structure is preserved

- **WHEN** the body contains a `##` heading and a bullet list
- **THEN** they render as a heading element and list items, not as literal `##` and `-` characters

---

### Requirement: Search, sort, filter, and list columns treat prompts generically

No type-specific branching SHALL be added to `filterCatalogItems`, `sortCatalogItems`, `filterByTopics`, or `filterByMyApp`. Prompt items participate through the existing generic fields.

`libs/catalog/src/components/ListView/columns.ts` currently hides the Folder column only for `CatalogEntityType.Model`. Prompt items SHALL keep the Folder column visible, since folder position is a prompt library's primary organising signal.

Prompt body text is NOT searchable: `filterCatalogItems` matches `name`, `description`, and `type` only. This is a known limitation, not a defect.

#### Scenario: Searching matches a prompt by name

- **WHEN** the user types a substring of a prompt's name into the catalog search
- **THEN** that prompt item appears in the results

#### Scenario: Searching matches prompts by type keyword

- **WHEN** the user searches `prompt`
- **THEN** every prompt item matches, because `filterCatalogItems` already tests `item.type`

#### Scenario: Searching does not match prompt body text

- **WHEN** the user searches for a phrase that appears only inside a prompt's `content`
- **THEN** that prompt does not appear in the results

#### Scenario: List view shows the Folder column for prompts

- **WHEN** the user switches to list view on the Prompts tab
- **THEN** the Folder column is rendered with each prompt's folder path

---

### Requirement: Lib documentation covers the new surface

`libs/catalog/README.md` SHALL document the `Prompt` entity type, the `promptContent` details field with the `Content` tab, the `isUnshareVisible` / `isRevokeShareVisible` predicates, and the `onDownload` / `isDownloadVisible` pair — including that the lib never learns the downloaded file's format. Every component name, prop name, and type name in a README example MUST exist with that exact spelling and shape — in particular, the README MUST NOT document `isFavoriteVisible`, which this change removes.

#### Scenario: README examples compile against the shipped API

- **WHEN** a reader copies the README's prompt example into a host app
- **THEN** every prop and type it names exists on the exported components with the documented shape
