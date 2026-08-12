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

`DetailsPanel` SHALL render a `Content` tab positioned immediately after `About` when `details.promptContent` is non-null, and hide it when absent — the same gating rule already applied to `overview`, `pricing`, `limits`, `api`, and `tools`. The tab body SHALL render the text read-only in a scrollable container (`overflow` on its own element, never on the page body), preserving whitespace and line breaks, with a copy-to-clipboard control.

`ItemDetailsTexts` SHALL gain `tabContentLabel?: string` (default `'Content'`), `copyContentAriaLabel?: string` (default `'Copy content'`), and `contentCopiedStatusLabel?: string` (default `'Copied'`). The copy confirmation SHALL be announced through a `role="status" aria-live="polite"` region separate from the button's own stable `aria-label`.

The tab body MUST use logical CSS properties (`ps-*`/`pe-*`, `text-start`) so it flips under `dir="rtl"`. The copy icon is symmetric and MUST NOT be mirrored.

#### Scenario: Content tab is shown when promptContent is present

- **WHEN** the details panel opens for an item whose `details.promptContent` is `{ content: 'Summarize {{text}}' }`
- **THEN** the tab row contains a `Content` tab positioned immediately after `About`
- **AND** selecting it renders `Summarize {{text}}` as read-only text with whitespace preserved

#### Scenario: Content tab is hidden when promptContent is absent

- **WHEN** the details panel opens for an item whose `details.promptContent` is `undefined`
- **THEN** the tab row contains no `Content` tab

#### Scenario: Copying the content announces confirmation

- **WHEN** the user activates the copy control in the Content tab
- **THEN** the prompt body is written to the clipboard
- **AND** the copy button's `aria-label` stays unchanged
- **AND** an `aria-live="polite"` status region announces the `contentCopiedStatusLabel` text

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

### Requirement: The unshare control is suppressible per item by host predicate

`libs/catalog` SHALL add one optional host predicate so a host can declare that unsharing does not exist for a given item, without the lib knowing why:

- `isUnshareVisible?: (item: CatalogItem) => boolean` on `CatalogProps` and `DetailsPanelProps`, combined (AND) with the lib's existing `!!onUnshare && item.isMyApp !== true && item.sharedWithMe === true` rule (`Header.tsx:153`).

It SHALL default to "visible" when absent, so every existing host renders identically to today, and SHALL be documented with JSDoc stating that default.

No favourite-visibility predicate is added. An earlier revision of this change added `isFavoriteVisible` to hide the star for prompts; prompts are favouritable now (see `prompt-catalog-integration`), which left the predicate with no caller. A lib prop that no host passes is dead public API and SHALL NOT be retained: the star renders for every entity type, prompts included.

No revoke-access predicate is added either: this branch's `libs/catalog` has no `onRevokeShare` callback and no owner-side revoke action, so a predicate gating it would be a prop nothing reads.

#### Scenario: Unshare action is hidden by predicate

- **WHEN** the details panel opens for an item with `sharedWithMe: true` and `onUnshare` supplied, and `isUnshareVisible` returns `false`
- **THEN** no "Remove from My List" action is rendered

#### Scenario: The predicate is optional and additive

- **WHEN** an existing consumer of `Catalog` passes no predicate
- **THEN** it compiles unchanged and every unshare control renders exactly as before

#### Scenario: The star renders for every entity type

- **WHEN** the catalog renders a card, a list row, and the details panel for a Prompt item
- **THEN** the star/favourite control is rendered in all three surfaces, exactly as it is for a Model item

---

### Requirement: A prompt's details panel shows exactly two tabs

`DetailsPanel` currently pushes the `About` tab unconditionally as the first tab. For `CatalogEntityType.Prompt` it SHALL be omitted, leaving `Content` (the body) followed by `Overview`, in that order.

The rationale is non-duplication, not capability: a prompt's description and its storage metadata are carried by the Overview tab, so an About tab would repeat them. Because this is a display rule rather than a host capability, it SHALL be a type check inside the lib — consistent with `ENTITY_TYPE_COLOR`, `TAB_ORDER`, and `Header`'s primary-action rule — and SHALL NOT add a host predicate.

Every other entity type SHALL keep the `About` tab exactly as before.

#### Scenario: A prompt with a body and overview data shows Content then Overview

- **WHEN** the details panel opens for a Prompt item whose `details` carry both `promptContent` and `overview`
- **THEN** the tab row contains exactly `Content` and `Overview`, in that order
- **AND** no `About` tab is rendered
- **AND** the prompt body is shown by default, because `Content` is the first tab

#### Scenario: A prompt with no resolved body shows only Overview

- **WHEN** the details panel opens for a Prompt item whose `details` carry `overview` but no `promptContent`
- **THEN** no `Content` tab is rendered

#### Scenario: Other entity types keep About

- **WHEN** the details panel opens for a Model item
- **THEN** the `About` tab is rendered first, as before this change

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

`libs/catalog/README.md` SHALL document the `Prompt` entity type, the `promptContent` details field with the `Content` tab, and the `isUnshareVisible` predicate. Every component name, prop name, and type name in a README example MUST exist with that exact spelling and shape — in particular, the README MUST NOT document `isFavoriteVisible`, which this change removes.

#### Scenario: README examples compile against the shipped API

- **WHEN** a reader copies the README's prompt example into a host app
- **THEN** every prop and type it names exists on the exported components with the documented shape
