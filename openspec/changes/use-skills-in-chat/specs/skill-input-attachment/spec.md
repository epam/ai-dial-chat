# Spec Delta: skill-input-attachment (new capability)

## ADDED Requirements

### Requirement: Skills entry in the Add menu

The Input's Add (`+`) menu SHALL show a "Skills" item (icon `IconBlocks`, i18n key `SkillSelectorI18nKeys.AddMenuLabel` (`skillSelector.addMenuLabel`) default "Skills") positioned directly below the "Prompts" item (or, when Prompts is absent, directly above "Chat settings"), on both the desktop dropdown and the mobile bottom sheet, only when the `features.skillUsageEnabled` feature flag is enabled for the session (frontend `useFeatureFlag('skillUsageEnabled')`, sourced from the client-config endpoint and the `SKILL_USAGE_ENABLED` env var — see the `config-registry-and-env-provider` delta). The favorite-skill data backing this item SHALL come from the already-loaded `SkillsContext` and `FavoriteApplicationsContext` state — no fetch is triggered by opening the menu.

#### Scenario: Feature flag disabled

- **WHEN** `features.skillUsageEnabled` is disabled for the session
- **THEN** the Add menu SHALL NOT render a "Skills" item, on either desktop dropdown or mobile bottom sheet

#### Scenario: Feature flag enabled, menu opened

- **WHEN** `features.skillUsageEnabled` is enabled and the user opens the Add menu
- **THEN** a "Skills" item with `IconBlocks` SHALL appear directly below the "Prompts" item and above "Chat settings"

---

### Requirement: Shared overlay-menu mechanism in `libs/conversation-input`

`libs/conversation-input`'s Add menu (`AddAttachmentButton`, and the `Input`/`ConversationInput` props forwarded to it) SHALL render host-injected overlay submenu entries from a generic configuration list — each entry carrying a `key`, menu-item `title`, `icon`, `renderOverlay(onClose)`, and mobile `backLabel` — rather than entity-type-specific props. The existing prompt-specific `promptsMenuOverlay`/`promptsMenuTitle`/`promptsBackLabel` props SHALL be removed in the same change, with the Prompts flow migrated onto the generic mechanism with no behavior change (same item position, same desktop nested-flyout chrome, same mobile stacked bottom sheet, same Escape/back behavior). The library SHALL NOT reference skills, prompts, or any other catalog entity type by name; icons, labels, and overlay content are host-supplied.

#### Scenario: Prompts behavior is unchanged after the refactor

- **WHEN** the app passes the Prompts overlay through the generic mechanism and the user opens the Add menu
- **THEN** the "Prompts" item renders in the same position with the same submenu behavior as before the refactor

#### Scenario: Two overlay entries render in order

- **WHEN** the app passes overlay entries for prompts and skills (both features enabled)
- **THEN** both menu items render in the configuration list's order, each opening its own submenu

#### Scenario: No domain knowledge in the lib

- **WHEN** `libs/conversation-input` is linted and type-checked
- **THEN** no source file references skills, prompts, or `OverlayFeature`/feature-flag machinery

---

### Requirement: Skills favorites panel ("My Collection")

Activating the "Skills" item (desktop hover/focus, mobile tap) opens a second-level panel with the same chrome the Prompts panel gets (desktop nested `Dropdown` submenu that stays open beside the main menu; mobile stacked bottom sheet with the shell's own back navigation). The panel SHALL contain, in order: a "My Collection" header, the list of the current user's favorite skills (personal, shared-with-me, and public sources — `favoriteIds` intersected against `SkillsContext`'s `skills` + `sharedWithMe` + `publicSkills`), a separator, and a "Browse" button (reusing the existing shared Browse i18n key). The header and "Browse" button SHALL always render, independent of whether the favorites list is empty.

Each favorite row SHALL show the skill's icon, its name, and — on the right — a filled star icon with `aria-pressed="true"` (toggling it off removes the skill from favorites via the existing `toggleFavorite(id, false, FavoriteEntityType.Skill)` and the row animates out without closing the panel). Clicking/activating a row's body SHALL select the skill (see the selection requirement below).

Each favorite row SHALL be wrapped in the ui-kit `InteractiveTooltip` (see the interactive-tooltip requirement below).

With zero favorites, the list area SHALL instead show "Star a skill to pin it here" (i18n key `SkillSelectorI18nKeys.EmptyHint`, `skillSelector.emptyHint`) in a secondary text color.

#### Scenario: Favorites present

- **WHEN** the user has one or more favorited skills and opens the Skills panel
- **THEN** each favorite renders with icon, name, and a filled, `aria-pressed="true"` star button
- **AND** a separator renders between the list and the "Browse" button

#### Scenario: No favorites

- **WHEN** the user has zero favorited skills and opens the Skills panel
- **THEN** the list area shows "Star a skill to pin it here"
- **AND** the "My Collection" header and "Browse" button still render

#### Scenario: Toggling a favorite off from the panel

- **WHEN** the user clicks the filled star on a row in the Skills panel
- **THEN** the skill is unfavorited via the existing favorites toggle and the row disappears from the list without closing the panel

---

### Requirement: Interactive tooltip on favorite-skill rows

Each favorite-skill row in the Skills panel SHALL be wrapped in the ui-kit `InteractiveTooltip` (with `asChild`, so the row itself remains the trigger). The panel SHALL open on row hover or keyboard focus, place itself to the row's end side on desktop (kit-default Right placement, flipping with direction), and be reachable by Tab from the row. The open state SHALL be panel-controlled: leaving the row or the panel SHALL only schedule a close after a short grace period (300 ms), and hover or focus reaching either side SHALL cancel the pending close — so the pointer can travel between the row and the panel without the panel vanishing under it. Its content SHALL be, top to bottom: the skill's description paragraph (a spinner while the fetch is in flight — see the lazy-resolution requirement below; the paragraph omitted entirely for a skill whose manifest has no description), and below it a link-style "View details" button (ui-kit `Button`, `variant Primary` + `appearance Link`) with an `IconEye` on its inline-start and its label from `skillSelector.viewDetailsLabel` ("View details"). The panel's max width on desktop SHALL be 550px (via the kit's `contentClassName`, overriding its 320px default). On a touch-only device the tooltip SHALL render nothing — the row still selects the skill on tap, and the row's accessible name SHALL never depend on the tooltip.

Clicking "View details" SHALL open the skill details side panel (next requirement) and close the Add menu and its tooltip.

#### Scenario: Hover with a resolved description

- **WHEN** the pointer rests on a favorite row whose description has been resolved
- **THEN** the interactive tooltip opens beside the row showing the description above the "View details" button
- **AND** it stays open while the pointer moves onto the panel itself

#### Scenario: First open before the description resolves

- **WHEN** a row's tooltip opens for the first time this session and the description fetch has not completed
- **THEN** the panel shows a spinner in the description's place, above the "View details" button

#### Scenario: Skill whose manifest has no description

- **WHEN** a skill's `SKILL.md` frontmatter contains no description (or the fetch failed)
- **THEN** the panel shows the "View details" button alone on every open, with no error surfaced

#### Scenario: Touch-only device

- **WHEN** the Skills panel is used on a touch-only device
- **THEN** no tooltip renders, and tapping the row still selects the skill

#### Scenario: "View details" click

- **WHEN** the user clicks "View details" in a row's tooltip
- **THEN** the skill details side panel opens for that skill and the Add menu and tooltip close

---

### Requirement: Lazy description resolution

Because DIAL Core's skill listing carries no `description` (an upstream gap — `ResourceItemMetadata` has no such field), a skill's description SHALL be fetched lazily: the first time a row's tooltip opens (hover or focus), the host (`useSkillSelectorOverlay`) SHALL perform one round-trip through the existing skill-file download endpoint to fetch the skill's `SKILL.md` and parse its frontmatter (the same manifest pipeline the skill details panel uses), and cache the result for the session in memory keyed by skill id. A second open of the same row's tooltip SHALL NOT trigger a second fetch. A fetch failure SHALL resolve to "no description" silently — no notification, no retry this session. The fetch SHALL be app-owned; `libs/skills` only reports the first open through a callback and renders the resolved value.

**Deferred condition (planned upstream change, user-confirmed):** DIAL Core will add `description` to the skill listing metadata. When it ships, the listing populates the tooltip directly, the per-skill `SKILL.md` downloads disappear (resolving the N+1 request pattern the lazy fetch introduces — one download per hovered skill per session), and the lazy fetch SHALL be dropped, together with its cleanup: the first-open callback (`onItemTooltipOpen`), the per-session description cache, the in-flight/pending state and the `isDescriptionLoading` spinner branch in `libs/skills`.

#### Scenario: First open triggers exactly one fetch

- **WHEN** a row's tooltip opens for the first time this session
- **THEN** the host fetches that skill's `SKILL.md` once and caches the parsed description (or its absence) for the session

#### Scenario: Subsequent opens use the cache

- **WHEN** the same row's tooltip opens again in the same session
- **THEN** no new fetch occurs and the cached description (or its absence) renders

#### Scenario: Fetch failure degrades silently

- **WHEN** the `SKILL.md` download or parse fails
- **THEN** the skill resolves to "no description" with no error notification, and no retry occurs this session

#### Scenario: No new endpoints

- **WHEN** the lazy fetch executes
- **THEN** it uses the existing skill-file download endpoint the catalog's details panel already uses — no new endpoint, client method, or DTO is introduced

---

### Requirement: "View details" opens the skill details side panel

The "View details" action in a row's tooltip SHALL open a right-anchored side panel on the chat route showing the selected skill's details, composed from `DetailsPanel` exported by `@epam/ai-dial-catalog` (see the `skill-details-panel` delta) via a `SkillDetailsSidePanel` wrapper in `libs/skills`. The wrapper SHALL NOT wrap or mount the full `CatalogView` (no tab persistence, sort/filter, or page chrome). The host SHALL own the panel's open state and supply the `CatalogItem` (built with the existing `mapSkillToCatalogItem`), the details fetch (reusing the existing skill details resolution — manifest + file listing — not a duplicate), the favorite toggle, and close handling; the panel's content-first tab behavior for skills SHALL match the Catalog page's skill details. The panel's header SHALL offer "Use in chat" (same action as the Catalog page's skill details, per the `catalog-use-in-chat` delta), which SHALL select the skill into the conversation input (same single-selection path as clicking the row) and close the panel.

#### Scenario: Opening the side panel

- **WHEN** the user clicks "View details" in a favorite row's tooltip
- **THEN** the side panel opens anchored to the chat route's end edge, showing that skill's details with the content-first tabs

#### Scenario: "Use in chat" from the side panel

- **WHEN** the user clicks "Use in chat" in the side panel's header
- **THEN** the skill becomes the input's selected skill (per the selection requirement), and the side panel closes

#### Scenario: Closing the side panel

- **WHEN** the user closes the side panel without clicking "Use in chat"
- **THEN** the panel closes and no skill is selected

---

### Requirement: Skills-only "Use skill" browse modal

Clicking "Browse" in the Skills panel SHALL open a modal titled "Use skill" (i18n key `SkillSelectorI18nKeys.ModalTitle`, `skillSelector.modalTitle`) that reuses the existing Catalog picker shell (`CatalogView` in selector mode) restricted to `CatalogEntityType.Skill` only — no other entity-type tab is shown. The modal SHALL include the same favorites strip, search, sort, and filter controls the Catalog page provides for the Skills type, and its cards SHALL be clickable the way model/agent/prompt cards are in the existing pickers. Selecting a card SHALL select that skill (next requirement) and close the modal; Escape/cancel closes it with no selection.

#### Scenario: Opening the browse modal

- **WHEN** the user clicks "Browse" in the Skills panel
- **THEN** the Skills panel closes and the "Use skill" modal opens showing only skill entities, with search/sort/filter available

#### Scenario: Selecting a card in the browse modal

- **WHEN** the user clicks a skill card in the "Use skill" modal
- **THEN** the modal closes and the skill is added to the conversation input per the selection requirement

#### Scenario: Cancelling the browse modal

- **WHEN** the user closes the "Use skill" modal without picking a card
- **THEN** no skill is selected and the conversation input is unchanged

---

### Requirement: Selecting a skill adds it to the conversation input

The conversation input SHALL hold at most one selected skill at a time. When a skill is selected — from a favorite row in the Skills panel, from a card in the "Use skill" modal, or via the Catalog page's "Use in chat" on a skill (see the `catalog-use-in-chat` delta) — it SHALL become the selected skill, replacing any previously selected skill, and SHALL be rendered inside the input as a chip in the accent-active control color (`text-control-accent-active` token family), carrying the skill's icon and name and a remove (×) control. The Skills panel or browse modal the selection came from SHALL close. Selecting the skill that is already selected SHALL leave exactly one chip (no duplicate, no churn). Removing the chip via its × SHALL clear the selection and change nothing else.

What a selected skill means at send time (completion payload, persistence in conversation history) is out of scope for this capability and deferred to the follow-up change.

#### Scenario: Selecting from favorites

- **WHEN** the user clicks a favorite skill row
- **THEN** the Skills panel closes and a chip for that skill appears inside the conversation input in the accent-active control color

#### Scenario: Selecting a different skill replaces the previous one

- **WHEN** a skill is already selected and the user selects a different skill
- **THEN** the input shows exactly one chip, for the newly selected skill

#### Scenario: Selecting the already-selected skill is idempotent

- **WHEN** the user selects the skill that is already selected
- **THEN** the input still shows exactly one chip for that skill

#### Scenario: Removing a selected skill

- **WHEN** the user clicks the × on a selected-skill chip
- **THEN** the chip is removed from the input and no skill is selected

---

### Requirement: Library boundaries for the skill-selection UI

The host-agnostic skill-selection UI SHALL live in a new `libs/skills` (`@epam/ai-dial-skills`) library — the favorites panel (rows wrapped in the ui-kit `InteractiveTooltip`), the `SkillDetailsSidePanel` wrapper composing `@epam/ai-dial-catalog`'s exported `DetailsPanel` (the lib peers on `@epam/ai-dial-catalog`), and the `FavoriteSkillItem` model. App-owned wiring SHALL stay in `apps/chat`: a `useSkillSelectorOverlay` hook (mirroring `usePromptSelectorOverlay`) that reads `SkillsContext`/`FavoriteApplicationsContext`, owns the modal, selection, and side-panel state, performs the lazy description fetch, and hands the generic overlay config and chip data to `libs/conversation-input`. Neither library SHALL read the feature flag itself, import app contexts, i18n, routing, or server-api modules; all strings arrive as props with English defaults, description data arrives via callbacks/state, and flag resolution happens in the app.

#### Scenario: Libs contain no app knowledge

- **WHEN** `libs/skills` and `libs/conversation-input` are linted and type-checked
- **THEN** no source file imports app contexts, `useTranslation`, routing, server-api modules, or feature-flag machinery

#### Scenario: Labels are prop-supplied with English defaults

- **WHEN** `FavoriteSkillsPanel` renders without a labels prop
- **THEN** its strings fall back to English defaults, and a host-supplied labels prop overrides every one of them

---

### Requirement: RTL support

All new skill-selection UI SHALL use logical Tailwind classes (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`/`start-*`/`end-*`) and CSS logical properties in stylesheets. `IconBlocks`, the star, `IconEye`, and the close icon are symmetric/conceptual and SHALL NOT be mirrored. The interactive tooltip's placement SHALL flip with direction (its end-side anchor and the side panel's end anchoring use logical positioning, so RTL mirrors them automatically).

#### Scenario: RTL layout

- **WHEN** the document direction is RTL
- **THEN** the Skills panel, its interactive tooltip, the browse modal, and the details side panel flip to follow the writing direction

---

### Requirement: Accessibility

- The favorite star button SHALL use `aria-pressed` reflecting favorite state.
- Decorative icons (`IconBlocks`, the skill icon glyph, the filled star glyph, the `IconEye` inside the tooltip's "View details" button) inside already-labeled controls SHALL be `aria-hidden`.
- The tooltip's "View details" button SHALL take its accessible name from its visible label (`skillSelector.viewDetailsLabel`); the row's accessible name SHALL come from the skill name alone, never from tooltip content.
- The selected-skill chip's × control SHALL have an accessible name (e.g. "Remove {skill name}") and the chip SHALL be reachable and operable from the keyboard.

#### Scenario: Screen reader announces the remove action

- **WHEN** a screen reader focuses a selected-skill chip's × control
- **THEN** it announces an accessible name identifying which skill is removed

---

### Requirement: i18n keys

The following app i18n keys SHALL be added under the `skillSelector` namespace in `apps/chat/src/i18n/locales/en.json` and the `SkillSelectorI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`: `addMenuLabel` ("Skills"), `emptyHint` ("Star a skill to pin it here"), `modalTitle` ("Use skill"), `viewDetailsLabel` ("View details" — verified absent from `en.json`, so a feature-scoped key is correct). Shared-value strings ("My Collection", "Browse", "Back", "Remove from favorites") SHALL reuse the existing keys that already carry those values rather than gaining same-value `skillSelector.*` copies, per the duplicate-translation-value rule.

#### Scenario: Labels use i18n values

- **WHEN** the Skills menu renders in a locale that has translated `skillSelector.addMenuLabel`
- **THEN** the menu item displays the translated label

---

### Requirement: No new backend endpoints

The capability SHALL NOT introduce new backend endpoints, generated-client methods, DTOs, or caches. Skill listing, details (manifest + file listing), favorites, and the tooltip's lazy description fetch (which reuses the existing skill-file download endpoint) flow through the existing skills and user-config endpoints the catalog already consumes.

#### Scenario: No API surface changes

- **WHEN** the change is complete
- **THEN** the generated OpenAPI client and the chat-api controllers are unchanged
