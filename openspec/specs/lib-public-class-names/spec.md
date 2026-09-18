# Spec: lib-public-class-names

## Purpose

The stable, host-addressable `dial-*` class contract that every library under `libs/*` emits. Because CSS-module locals are hashed at build time and Tailwind utilities move with the layout, a host embedding these libraries had nothing durable to target and resorted to `[class*='…']` substrings, `:nth-child`, and ARIA attributes — all of which broke on package upgrades. Covers the naming grammar, the one-constants-file-per-library rule and its typed export, the unconditional-emission and no-declarations guarantees, the per-library class inventories, the direction-agnostic and ARIA-is-not-a-hook rules, the stability promise, and the guard-test and README obligations that keep the contract from eroding silently. Introduced for [issue #8707](https://github.com/epam/ai-dial-chat/issues/8707).

## Requirements

### Requirement: Public class naming convention

Every publicly addressable element in a `libs/*` component SHALL carry a class name of
the form `dial-<lib-prefix>-<element>[-<state>]`, where:

- `<lib-prefix>` is the library's **directory name** under `libs/`
  (`dial-catalog-card`, `dial-scheduled-tasks-card`, `dial-settings-panel-tab`).
  Directory names are unique by construction, so a prefix can never be claimed twice
  and a new library needs no decision.
- Five libraries are grandfathered onto the short prefixes issue #8707 named by hand —
  `sb` for `libs/sidebar`, `cp` for `libs/conversation-panel`, `cm` for
  `libs/conversation-messages`, `ci` for `libs/conversation-input`, `ai` for
  `libs/attachment-input`. This is a **closed list**; no further library may take a
  short prefix. The rule was first written as "the library's CSS-custom-property
  prefix", which does not generalise — five var prefixes are claimed by two libraries
  each, and eleven of the twenty-two libraries with stylesheets use more than one of
  their own. See §Public class names of `openspec/lib-styling-guide.md` for the
  measurements.
- `<element>` and `<state>` are lower-case kebab-case segments. BEM separators (`__`,
  `--`) MUST NOT be used.
- A state is expressed as an **additive** class applied alongside the base class, never
  as a replacement for it.

The convention MUST match `@epam/ai-dial-ui-kit`'s existing public classes
(`dial-kit-input`, `dial-kit-input-error`, `dial-kit-grid-selection-visible`).

#### Scenario: Selected attachment tile carries both base and state class

- **WHEN** an attachment tile is rendered with `isSelected` set to `true`
- **THEN** its class attribute contains both `dial-ai-attachment-tile` and
  `dial-ai-attachment-tile-selected`

#### Scenario: Unselected attachment tile carries only the base class

- **WHEN** an attachment tile is rendered with `isSelected` unset or `false`
- **THEN** its class attribute contains `dial-ai-attachment-tile` and does **not**
  contain `dial-ai-attachment-tile-selected`

---

### Requirement: Public classes are emitted unconditionally and carry no declarations

Each public class SHALL be emitted on every render of its element, with no prop, flag,
context value, or host configuration required to enable it. No library SHALL declare
any CSS rule for a `dial-<lib-prefix>-*` class in its own `.module.scss` or in the
stylesheet it publishes at `./styles.css`: the classes exist solely as host-addressable
hooks and MUST NOT change any computed style by themselves.

Public classes SHALL be appended through the existing `mergeClasses` call for the
element, as the final argument — after its CSS-module class, its Tailwind utilities, and
any caller-supplied `className`. Relative ordering within the emitted `class` attribute
SHALL NOT be relied upon by a host: the argument position is a source-code convention,
not a cascade guarantee.

#### Scenario: Class is present without any prop being passed

- **WHEN** `ConversationInput` is rendered with only its required props
- **THEN** the root element's class attribute contains `dial-ci-wrapper`

#### Scenario: Public classes are absent from the published stylesheet

- **WHEN** `libs/<lib>/dist/index.css` is inspected after `npm exec nx build <lib>`
- **THEN** it contains no selector matching `.dial-sb-`, `.dial-cp-`, `.dial-cm-`,
  `.dial-ci-`, or `.dial-ai-`

#### Scenario: Caller-supplied className still applies

- **WHEN** `ConversationInput` is rendered with `className="host-root"`
- **THEN** the root element's class attribute contains both `host-root` and
  `dial-ci-wrapper`

---

### Requirement: Class names are exported as typed constants

Each affected library SHALL define its public class names in
`libs/<lib>/src/constants/public-class-names.ts` as a single `as const` record and
SHALL re-export that record from `libs/<lib>/src/index.ts`, following the existing
constant-export precedent (`ATTACHMENT_COLLAPSE_THRESHOLD`, `MAX_UPLOADS_PER_MINUTE`).

The record name SHALL be the library's directory name upper-snake-cased and suffixed
`_CLASS` — `SIDEBAR_CLASS`, `CONVERSATION_INPUT_CLASS`, `SCHEDULED_TASKS_CLASS`. The
full set is tabulated under §Every library with host-addressable elements carries the
contract.

Every component that stamps a public class SHALL read it from this record. A public
class name MUST NOT appear as a string literal in any component file.

#### Scenario: Host can import the class names

- **WHEN** a consumer writes
  `import { ATTACHMENT_INPUT_CLASS } from '@epam/ai-dial-attachment-input'`
- **THEN** the import resolves and `ATTACHMENT_INPUT_CLASS.tile` is typed as the literal
  string `'dial-ai-attachment-tile'`

#### Scenario: Components do not hardcode the strings

- **WHEN** `libs/<lib>/src/components/**` is searched for the literal text
  `dial-<lib-prefix>-`
- **THEN** no match is found outside `constants/public-class-names.ts` and `tests/`

---

### Requirement: ARIA attributes are not styling hooks

The libraries SHALL NOT treat `role`, `aria-label`, or any other accessibility
attribute as a styling contract. This change SHALL add, remove, or alter no ARIA
attribute, no `role`, and no default label text, and every existing accessibility
assertion in the affected libraries SHALL continue to pass unchanged.

Where a host previously selected an element by `role` plus a default `aria-label` — in
particular `[role='list'][aria-label='Attached files']`, whose label is overridable via
`AttachmentTrayProps.labels.ariaLabel` — the corresponding public class SHALL be
available on that same element.

#### Scenario: Tray remains addressable after its label is localised

- **WHEN** `AttachmentTray` is rendered with `labels={{ ariaLabel: 'Вложения' }}`
- **THEN** the tray element's `aria-label` is `'Вложения'` **and** its class attribute
  contains `dial-ai-attachment-tray`

#### Scenario: Existing roles are untouched

- **WHEN** the affected components are rendered
- **THEN** `SidebarPanel`'s `<aside>` still exposes `role="complementary"`,
  `AttachmentTray` still exposes `role="list"` with `role="listitem"` children,
  `AssistantMessageBubble`'s streaming region still exposes `aria-live="polite"`, and
  the attachment tile still exposes `role="button"` with `aria-busy` while loading

---

### Requirement: Composer public classes

`libs/conversation-input` SHALL stamp the following classes in
`components/Input/Input.tsx` and `components/Input/ModelSelectorControl.tsx`:

| Class                           | Element                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `dial-ci-wrapper`               | The `Input` root `<div>` that carries `styles.wrapper`                                               |
| `dial-ci-action-row`            | The row wrapper rendered when the action bar is visible (today `flex flex-wrap items-center gap-2`)  |
| `dial-ci-textarea-wrap`         | The `<div>` that wraps the textarea area inside the action row                                       |
| `dial-ci-add-cluster`           | The `<div>` that wraps the add-attachment button node                                                |
| `dial-ci-tools-chips`           | The `<div>` that wraps the `ToolsChips` row inside the action row                                    |
| `dial-ci-footer-actions`        | The trailing cluster holding the model selector, mic, and send/stop buttons (today `ms-auto …`)       |
| `dial-ci-model-selector-button` | Every `<button>` that carries `styles.modelSelectorButton`, in all three branches of `ModelSelectorControl` |

`dial-ci-wrapper` SHALL be additive to the existing `inputClassName` and `className`
props, which keep their current behaviour.

#### Scenario: Action row is addressable without DOM-order selectors

- **WHEN** `ConversationInput` is rendered with the action bar visible
- **THEN** exactly one element carries `dial-ci-action-row`, and its children carrying
  `dial-ci-textarea-wrap` and `dial-ci-footer-actions` are both present

#### Scenario: Action row is absent when the action bar is hidden

- **WHEN** `ConversationInput` is rendered with `hideActionBar` set to `true`
- **THEN** no element carries `dial-ci-action-row`

#### Scenario: Add cluster appears only when the add button is rendered

- **WHEN** `ConversationInput` is rendered with `hideAddButton` set to `true`
- **THEN** no element carries `dial-ci-add-cluster`

#### Scenario: Tool chips cell is addressable, and absent without tools

- **WHEN** `ConversationInput` is rendered with at least one visible tool in
  `toolsMenuItems` and an `onToolToggle` handler
- **THEN** the `<div>` wrapping the chips carries `dial-ci-tools-chips` and descends
  from `dial-ci-action-row`
- **AND WHEN** it is rendered with no tools
- **THEN** no element carries `dial-ci-tools-chips`

#### Scenario: Model selector button is addressable on desktop

- **WHEN** `ConversationInput` is rendered with `deployments` and a
  `selectedDeploymentId` on a desktop viewport
- **THEN** the model selector trigger `<button>` carries
  `dial-ci-model-selector-button`

#### Scenario: Model selector button is addressable on mobile

- **WHEN** the same component is rendered on a mobile viewport
- **THEN** the model selector trigger carries `dial-ci-model-selector-button`

---

### Requirement: Model menu public classes

`libs/conversation-input` SHALL stamp the following classes on the model-selector menu:

| Class                              | Element                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `dial-ci-model-menu`               | The floating menu root — appended to every `Dropdown` `listClassName` in `ModelSelectorControl.tsx`, and to the `BottomSheetShell` `className` in the mobile branch |
| `dial-ci-model-menu-search`        | The sticky search header `<div>` built by `useModelSelector`'s `menuHeader`                            |
| `dial-ci-model-menu-item`          | Every deployment row, via `DropdownItem.className`                                                     |
| `dial-ci-model-menu-item-selected` | The row matching `selectedDeploymentId`, additive to `dial-ci-model-menu-item`                         |

This requirement SHALL be satisfied without any change to `@epam/ai-dial-ui-kit`:
`Dropdown` already accepts `listClassName` for the floating overlay and
`DropdownItem.className` for each row.

`useModelSelector`'s existing `searchHeaderClassName` option SHALL keep its current
behaviour; `dial-ci-model-menu-search` is appended in addition to whatever it supplies.

A class for the selected row's **check indicator** is explicitly NOT in scope. The
check is drawn entirely by `@epam/ai-dial-ui-kit` from `DropdownItem`'s
`mark: MenuItemMark.Check` plus `checked`, so no element in this repository owns it.
Hosts needing to restyle the check SHALL target the selected row through
`dial-ci-model-menu-item-selected`; a `dial-kit-*` class on the mark itself belongs to
the ui-kit follow-up.

#### Scenario: Menu root is addressable when open

- **WHEN** the desktop model selector menu is opened
- **THEN** the floating overlay element carries `dial-ci-model-menu`

#### Scenario: Selected row is distinguishable from the rest

- **WHEN** the menu is open with `selectedDeploymentId` matching the second deployment
- **THEN** every row carries `dial-ci-model-menu-item`, and only the second row also
  carries `dial-ci-model-menu-item-selected`

#### Scenario: Search header is addressable

- **WHEN** the menu is opened with a non-empty `deployments` list and no loading state
- **THEN** the sticky search header carries `dial-ci-model-menu-search`

#### Scenario: Mobile sheet is addressable

- **WHEN** the model selector is opened on a mobile viewport
- **THEN** the bottom-sheet container carries `dial-ci-model-menu`

#### Scenario: Memoised menu content gains no new dependency

- **WHEN** `useModelSelector` recomputes `menuHeader` and `menuItems`
- **THEN** their `useMemo` dependency arrays are unchanged from before this change,
  because the class names are module-level constants

---

### Requirement: Attachment tray and tile public classes

`libs/attachment-input` SHALL stamp the following classes:

| Class                              | Element                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `dial-ai-attachment-tray`          | The `role="list"` root of `AttachmentTray`                                                    |
| `dial-ai-attachment-tray-item`     | Each `role="listitem"` wrapper inside the tray                                                |
| `dial-ai-attachment-tile`          | The tile element in both `File.tsx` and `Image.tsx`                                           |
| `dial-ai-attachment-tile-selected` | The tile when `isSelected` is `true`, additive to the base class                              |
| `dial-ai-attachment-tile-name`     | The filename element                                                                          |
| `dial-ai-attachment-tile-type`     | The type/size row                                                                             |
| `dial-ai-attachment-tile-action`   | Every corner action button — download, retry, open-link, remove                               |

`ATTACHMENT_TILE_BASE_CLASS` SHALL remain a pure Tailwind-utility constant. Its
published JSDoc describes it as exactly that, and mixing a public styling hook into it
would change the meaning of an already-exported constant, so the tile class is stamped
at each renderer from `ATTACHMENT_INPUT_CLASS.tile` instead.

#### Scenario: Both tile renderers carry the tile class

- **WHEN** a tray is rendered containing one image attachment and one non-previewable
  file attachment
- **THEN** both tiles carry `dial-ai-attachment-tile`

#### Scenario: Tray items are individually addressable

- **WHEN** a tray is rendered with three attachments
- **THEN** exactly one element carries `dial-ai-attachment-tray` and exactly three
  carry `dial-ai-attachment-tray-item`

#### Scenario: Every corner action shares one class

- **WHEN** a file attachment is rendered in an error state with both retry and remove
  available
- **THEN** both action buttons carry `dial-ai-attachment-tile-action` and retain their
  existing `aria-label` and `aria-describedby` attributes

#### Scenario: Group-hover reveal behaviour is unchanged

- **WHEN** a tile is rendered
- **THEN** its action buttons keep their existing
  `group-hover/attachment-tile:opacity-100` and
  `group-focus-within/attachment-tile:opacity-100` utilities, and the tile keeps
  `group/attachment-tile`

---

### Requirement: Panel and message public classes

The following classes SHALL be stamped:

| Library                 | Class                        | Element                                                              |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `sidebar`               | `dial-sb-aside`              | The `<aside role="complementary">` in `SidebarPanel.tsx`             |
| `sidebar`               | `dial-sb-header`             | The root `<div>` of `Header.tsx`                                     |
| `conversation-panel`    | `dial-cp-new-chat-button`    | The `<button>` in `NewChatButton.tsx`                                |
| `conversation-panel`    | `dial-cp-search`             | The `role="search"` wrapper in `ConversationPanel.tsx`               |
| `conversation-messages` | `dial-cm-user-bubble`        | The bubble `<div>` carrying `styles.userBubble`                      |
| `conversation-messages` | `dial-cm-assistant-content`  | The `aria-live="polite"` content region in `AssistantMessageBubble.tsx` |

`Header` and `NewChatButton` are wrapped in `memo`; adding a module-level constant class
SHALL NOT introduce a new prop or otherwise affect their memoisation.

#### Scenario: Sidebar aside is addressable without a role selector

- **WHEN** `SidebarPanel` is rendered
- **THEN** the element with `role="complementary"` also carries `dial-sb-aside`

#### Scenario: New-chat button is addressable without DOM-order selectors

- **WHEN** `ConversationPanel` is rendered
- **THEN** exactly one `<button>` carries `dial-cp-new-chat-button`

#### Scenario: Assistant content region is addressable

- **WHEN** `AssistantMessageBubble` is rendered with non-empty text
- **THEN** the element carrying `aria-live="polite"` also carries
  `dial-cm-assistant-content`

#### Scenario: User bubble is addressable without hashed-class matching

- **WHEN** `UserMessageBubble` is rendered with non-empty text
- **THEN** the bubble element carries `dial-cm-user-bubble`

---

### Requirement: Public classes are direction-agnostic

The public classes SHALL carry no direction-dependent meaning and SHALL be identical
under `dir="ltr"` and `dir="rtl"`. No class name SHALL encode a physical direction
(no `-left`, `-right`). The affected elements' existing logical Tailwind utilities
(`ms-auto`, `ps-4`, `pe-2`, `end-1`, `text-start`) SHALL be left unchanged.

Library READMEs SHALL note that a host styling through these classes is responsible for
using CSS logical properties so its own overrides flip correctly.

#### Scenario: Class set does not change with direction

- **WHEN** the composer is rendered inside a `dir="rtl"` ancestor
- **THEN** the emitted `dial-ci-*` classes are the same set as under `dir="ltr"`

#### Scenario: No physical direction in any class name

- **WHEN** the five `public-class-names.ts` records are inspected
- **THEN** no value contains `left` or `right`

---

### Requirement: Stability and deprecation promise

Once published, a `dial-<lib-prefix>-*` class SHALL be treated as public API of its
package:

- Renaming a class, removing it, or **moving it to a different element** SHALL be
  treated as a breaking change — a host's selector targets the element, not merely the
  name.
- Any such change SHALL be announced as a breaking change through the package's normal
  release-notes channel and SHALL be recorded in that library's `README.md` together
  with its replacement, in the same change.
- Adding a new public class is non-breaking.

Note on enforcement: every `libs/*/package.json` in this repository is pinned at
`0.0.1` with `private: true`, and the published version is stamped by the
`epam/ai-dial-ci` release pipeline. The in-repo version field therefore cannot carry
this promise, so it is enforced by the guard tests and by the README requirement below
rather than by a version bump in the repository.

The element a class is attached to MAY have its internal Tailwind utilities, CSS-module
class, or position in the DOM changed freely — that is the entire point of the contract.

#### Scenario: Refactoring the DOM does not break the contract

- **WHEN** the composer's action row children are reordered
- **THEN** `dial-ci-textarea-wrap`, `dial-ci-add-cluster`, and
  `dial-ci-footer-actions` remain on the same logical elements and the guard tests
  still pass

---

### Requirement: Guard tests prevent silent loss of the contract

Every public class SHALL be asserted by at least one co-located test in its library's
`tests/` folder, resolving the expected value from the exported constants record rather
than from a duplicated literal. Removing a public class from its element MUST fail a
test.

Tests SHALL locate elements by role, label, or text — never by the public class itself
— and then assert the class is present, so that a test cannot pass by finding the class
on the wrong element.

#### Scenario: Removing a class fails the suite

- **WHEN** `dial-ai-attachment-tray` is removed from `AttachmentTray`
- **THEN** `npm run test:file -- libs/attachment-input/src/components/AttachmentTray/tests/AttachmentTray.spec.tsx`
  fails

#### Scenario: Every exported name is covered

- **WHEN** the five constants records are compared against the classes asserted in tests
- **THEN** every exported value is asserted at least once

---

### Requirement: Every library with host-addressable elements carries the contract

The contract SHALL cover all 25 libraries under `libs/*` that render host-addressable
UI, not only the five issue #8707 named. Each SHALL own a
`src/constants/public-class-names.ts`, export its record from `src/index.ts`, and
document it in its `README.md`:

| Library | Exported record |
| --- | --- |
| `libs/attachment-canvas` | `ATTACHMENT_CANVAS_CLASS` |
| `libs/attachment-input` | `ATTACHMENT_INPUT_CLASS` |
| `libs/builder-form` | `BUILDER_FORM_CLASS` |
| `libs/catalog` | `CATALOG_CLASS` |
| `libs/chat-shared` | `CHAT_SHARED_CLASS` |
| `libs/conversation-input` | `CONVERSATION_INPUT_CLASS` |
| `libs/conversation-messages` | `CONVERSATION_MESSAGES_CLASS` |
| `libs/conversation-panel` | `CONVERSATION_PANEL_CLASS` |
| `libs/conversation-stages` | `CONVERSATION_STAGES_CLASS` |
| `libs/mcp-apps` | `MCP_APPS_CLASS` |
| `libs/navigation-panel` | `NAVIGATION_PANEL_CLASS` |
| `libs/prompt-editor` | `PROMPT_EDITOR_CLASS` |
| `libs/prompts` | `PROMPTS_CLASS` |
| `libs/publish-panel` | `PUBLISH_PANEL_CLASS` |
| `libs/quotations` | `QUOTATIONS_CLASS` |
| `libs/scheduled-tasks` | `SCHEDULED_TASKS_CLASS` |
| `libs/settings-panel` | `SETTINGS_PANEL_CLASS` |
| `libs/share` | `SHARE_CLASS` |
| `libs/sidebar` | `SIDEBAR_CLASS` |
| `libs/skill-editor` | `SKILL_EDITOR_CLASS` |
| `libs/skills` | `SKILLS_CLASS` |
| `libs/source-panel` | `SOURCE_PANEL_CLASS` |
| `libs/starter-buttons` | `STARTER_BUTTONS_CLASS` |
| `libs/toolset-editor` | `TOOLSET_EDITOR_CLASS` |
| `libs/usage-dashboard` | `USAGE_DASHBOARD_CLASS` |

Libraries that render no host-addressable chrome of their own — pure hook, model, or
utility packages — are exempt and SHALL NOT be given an empty record.

#### Scenario: Each record is reachable from the package entry point

- **WHEN** a host imports the record named above from the library's package root
- **THEN** the import resolves and every value in it is a `dial-`-prefixed string

#### Scenario: No class name is written as a literal in a component

- **WHEN** any library's `src/**/*.tsx` is searched for a `dial-` string literal
- **THEN** no match exists outside `constants/public-class-names.ts` and test files

---

### Requirement: Public classes are documented per library

Each affected library's `README.md` SHALL gain a section listing its public classes,
the element each is attached to, the exported constants record to import them from, and
the stability promise. The shared convention, the rationale for flat kebab-case, and the
rule that ARIA attributes are not styling hooks SHALL be documented once in
`openspec/lib-styling-guide.md` and linked from each README rather than restated.

`docs/architecture.md`'s styling-tier summary SHALL gain the public-class tier.

`npm run validate:docs` SHALL pass, including its check that every name a lib README
imports from its own package is actually exported.

#### Scenario: README names resolve

- **WHEN** `npm run validate:docs` runs after the README updates
- **THEN** it reports no unresolved imported name and no broken relative link

#### Scenario: Convention is documented once

- **WHEN** the updated READMEs are read
- **THEN** each links to `openspec/lib-styling-guide.md` for the convention instead of
  restating the naming rules

---

### Requirement: No state, i18n, feature-flag, telemetry, or endpoint impact

This capability SHALL introduce no state and therefore no owning context or hook; no
user-visible string and therefore no i18n key; no feature-flag gate under
`ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`; no telemetry or metric; and no HTTP
endpoint, DTO, generated-client operation, cache entry, or rate limit.

No library SHALL gain knowledge of a host selector, stylesheet, route, storage key,
environment variable, feature flag, or API path: the class names MUST be literal
constants owned by and defined inside each library, so no app-level adapter is required.

#### Scenario: No new dependency or host knowledge

- **WHEN** the change is reviewed against `AGENTS.md` §Library isolation
- **THEN** no affected library reads `document`, host configuration, an environment
  variable, or a feature flag to decide which classes to emit, and no
  `package.json` dependency or peer dependency is added
