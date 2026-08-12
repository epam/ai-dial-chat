## ADDED Requirements

### Requirement: Prompts entry in the Add menu

The Input's Add (`+`) menu SHALL show a "Prompts" item (icon `IconPrompt`, i18n key `PromptSelectorI18nKeys.AddMenuLabel` (`promptSelector.addMenuLabel`) default "Prompts") positioned immediately above "Chat settings", only when `OverlayFeature.Prompts` is enabled for the current session (same gate as `CatalogView`'s `isPromptsEnabled`). The favorite-prompts data backing this item SHALL be fetched once `PromptsProvider`/`FavoriteApplicationsProvider` resolve on conversation load (existing or new conversation) — no separate fetch is triggered by opening the menu.

#### Scenario: Feature flag disabled
- **WHEN** `OverlayFeature.Prompts` is disabled for the session
- **THEN** the Add menu SHALL NOT render a "Prompts" item, on both desktop dropdown and mobile bottom sheet

#### Scenario: Feature flag enabled, menu opened
- **WHEN** `OverlayFeature.Prompts` is enabled and the user opens the Add menu
- **THEN** a "Prompts" item with `IconPrompt` SHALL appear directly above "Chat settings"

### Requirement: Favorites panel ("My Collection")

Tapping the "Prompts" item (mobile) opens a second-level bottom sheet; clicking it (desktop) opens a second-level panel — desktop's is a top-level flyout that visually replaces the main "+" menu rather than nesting inside it, because the ui-kit's nested-`DropdownItem.children` mechanism unconditionally renders each nested item as a fixed-height, truncating button and cannot host this panel's rich content (see design.md §2). The panel SHALL contain, in order: an optional back chevron (desktop only — see the back-navigation scenario below), a "My Collection" header (i18n key `PromptSelectorI18nKeys.MyCollectionLabel` (`promptSelector.myCollectionLabel`)), the list of the current user's favorite prompts (personal, shared-with-me, and public sources — `favoriteIds` intersected against `PromptsContext`'s `prompts` + `sharedWithMe` + `publicPrompts`), and a "Browse" button reusing `ButtonsI18nKeys.Browse`. The header and "Browse" button SHALL always render, independent of whether the favorites list is empty.

Each favorite row SHALL show, left-to-right: the prompt's icon, its name, and — on the right — a filled star icon indicating favorite status with `aria-pressed="true"` (toggling it off removes the prompt from favorites via the existing `toggleFavorite(id, false, FavoriteEntityType.Prompt)`). No version subtext is shown (prompts are unversioned). Hovering a row (desktop) SHALL show the prompt's `description` in a tooltip positioned to the right of the row; rows with an empty description show no tooltip.

#### Scenario: Favorites present
- **WHEN** the user has one or more favorited prompts and opens the Prompts panel
- **THEN** each favorite renders with icon, name, and a filled, `aria-pressed="true"` star button
- **AND** hovering a row's description area shows the prompt's description in a tooltip

#### Scenario: No favorites
- **WHEN** the user has zero favorited prompts and opens the Prompts panel
- **THEN** the list area SHALL instead show the text "Star a prompt to pin it here" (i18n key `PromptSelectorI18nKeys.EmptyHint`, `promptSelector.emptyHint`) in a secondary text color
- **AND** the "My Collection" header and "Browse" button SHALL still render

#### Scenario: Toggling a favorite off from the panel
- **WHEN** the user clicks the filled star on a row in the Prompts panel
- **THEN** the prompt SHALL be unfavorited via the existing favorites toggle and disappear from the list without closing the panel

#### Scenario: Returning to the main Add menu from the Prompts panel (desktop)
- **WHEN** the user opens the desktop Prompts panel (which has replaced the main "+" menu) and clicks the back chevron in its header
- **THEN** the Prompts panel SHALL close and the main "+" menu SHALL reopen in its place

#### Scenario: Returning to the main Add sheet from the Prompts sheet (mobile)
- **WHEN** the user opens the mobile Prompts bottom sheet and taps its back arrow
- **THEN** the Prompts sheet SHALL close and the main Add bottom sheet SHALL reopen — this back arrow is rendered by the shared `BottomSheetShell` chrome, not by the Prompts panel's own header, since the mobile sheet already owns back-navigation

### Requirement: Prompts-only "Use prompt" browse modal

Clicking "Browse" in the Prompts panel SHALL open a modal titled "Use prompt" (i18n key `PromptSelectorI18nKeys.ModalTitle`, `promptSelector.modalTitle`) that reuses the existing Catalog picker shell (`CatalogView` in selector mode, wrapped the same way `CatalogModal` wraps it for the model/agent picker) restricted to `CatalogEntityType.Prompt` only — no Models/Agents/Toolsets tab is shown. The modal SHALL include the same "My collection" favorites strip, search, sort, and filter controls the Catalog page already provides for the Prompts type, and its cards SHALL be clickable the same way model/agent cards are in the existing picker.

#### Scenario: Opening the browse modal
- **WHEN** the user clicks "Browse" in the Prompts panel
- **THEN** the Prompts panel SHALL close and the "Use prompt" modal SHALL open showing only prompt entities, with search/sort/filter available

#### Scenario: Selecting a card in the browse modal
- **WHEN** the user clicks a prompt card in the "Use prompt" modal
- **THEN** the selection SHALL follow the same parameter-resolution flow defined below, with the modal remaining open behind the parameters popup (see back-navigation requirement)

### Requirement: Immediate insertion for parameter-less prompts

When a prompt is selected (from a favorite row directly, or from a card in the "Use prompt" modal) and its `content` contains no `{{param}}` tokens per the existing token grammar (`{{` + one or more non-brace characters + `}}`, already defined by `libs/chat-shared`'s `PROMPT_PARAM_PATTERN` (relocated there from `libs/catalog`; also used by `rehypePromptVariables`) and reused rather than redefined — see design.md §1; a single-brace sequence such as `{name}` is literal text, not a parameter), the prompt's `content` SHALL be inserted into the active chat composer's textarea immediately, with no intermediate popup, and any open Prompts panel / "Use prompt" modal SHALL close.

#### Scenario: Selecting a parameter-less favorite
- **WHEN** the user clicks a favorite prompt row whose content has no `{{...}}` tokens
- **THEN** the Prompts panel closes and the prompt's content appears in the composer's textarea

#### Scenario: Selecting a parameter-less prompt from the browse modal
- **WHEN** the user selects a prompt card with no `{{...}}` tokens from the "Use prompt" modal
- **THEN** the modal closes and the prompt's content appears in the composer's textarea

### Requirement: "Prompt parameters" popup for parameterized prompts

When the selected prompt's content contains one or more `{{param}}` tokens, a "Prompt parameters" popup (i18n key `PromptSelectorI18nKeys.ParametersTitle`, `promptSelector.parametersTitle`) SHALL open instead of inserting immediately. The header SHALL show the title and a close button (`aria-label` i18n key `PromptSelectorI18nKeys.CloseLabel` (`promptSelector.closeLabel`), default "Close"). When the popup was opened from the "Use prompt" modal, the header SHALL additionally show a back chevron (`IconChevronLeft`, mirrored `rtl:scale-x-[-1]`, `aria-label` i18n key `PromptSelectorI18nKeys.BackLabel` (`promptSelector.backLabel`), default "Back") that closes the popup and reopens the "Use prompt" modal with its prior state intact. When opened directly from a favorite row in the Add menu, no back chevron SHALL render.

The body SHALL show, top to bottom:
1. A full-width, 72px-tall prompt summary card (background `var(--bg-layer-sunken, #eef1f7)`, `border: 1px solid var(--stroke-tertiary, #e0e6f0)`) rendering `libs/catalog`'s shared `AppIdentity` block (icon or fallback initials, the "PROMPT" entity-type label, and the prompt's name) at its `lg` size — the same identity block used throughout the Catalog, not a bespoke icon+label layout.
2. With a 16px gap below the card, a two-column section, each column headed with Heading 2 typography (`dial-h2-text`): left column "Parameters" (i18n key `PromptSelectorI18nKeys.ParametersLabel`, `promptSelector.parametersLabel`) containing one required `Textarea` per distinct `{{param}}` token found in the content (in first-occurrence order; a token repeated multiple times yields exactly one input), each labeled with the parameter name and placeholder "Enter value" (i18n key `PromptSelectorI18nKeys.EnterValuePlaceholder`, `promptSelector.enterValuePlaceholder`); right column "Details" (i18n key `PromptSelectorI18nKeys.DetailsLabel`, `promptSelector.detailsLabel`) rendering, via the Catalog's shared `ContentTab` component (reused directly from `libs/catalog`, not duplicated): the prompt's `description` (when non-empty) followed by a divider, then the full prompt content read-only with `{{param}}` tokens highlighted.

The footer SHALL show a tertiary "Cancel" button (`ButtonsI18nKeys.Cancel`) and a primary "Submit" button (reusing the existing submit/confirm i18n label already used elsewhere in the app), with Submit disabled until every parameter field is non-empty.

#### Scenario: Opening from a favorite (no back button)
- **WHEN** the user clicks a favorite prompt row whose content has `{{param}}` tokens
- **THEN** the "Prompt parameters" popup opens with a close button and no back chevron

#### Scenario: Opening from the browse modal (with back button)
- **WHEN** the user selects a card with `{{param}}` tokens from the "Use prompt" modal
- **THEN** the "Prompt parameters" popup opens with both a close button and a back chevron

#### Scenario: Returning to the browse modal
- **WHEN** the user clicks the back chevron in the popup opened from the "Use prompt" modal
- **THEN** the popup closes and the "Use prompt" modal reopens

#### Scenario: Submit disabled until all parameters filled
- **WHEN** at least one required parameter field is empty
- **THEN** the Submit button SHALL be disabled

#### Scenario: Prompt with a description
- **WHEN** the selected prompt has a non-empty `description`
- **THEN** the Details column SHALL show the description, then a divider, then the rendered content

#### Scenario: Prompt without a description
- **WHEN** the selected prompt has no `description`
- **THEN** the Details column SHALL show only the rendered content, with no divider

#### Scenario: Duplicate parameter tokens
- **WHEN** the prompt content contains the same `{{param}}` token more than once
- **THEN** the Parameters column SHALL show exactly one input for that parameter name

### Requirement: Parameter substitution and insertion on submit

Clicking Submit SHALL replace every occurrence of each `{{param}}` token in the prompt's content with the corresponding field's entered value, insert the resulting text into the active chat composer's textarea, and close the popup (and, if it was opened via the browse modal, close that modal too rather than reopening it). Clicking Cancel SHALL close the popup (returning to the browse modal if that was the entry point, per the back-navigation requirement) without modifying the composer's textarea.

#### Scenario: Submitting with values entered
- **WHEN** the user fills every parameter field and clicks Submit
- **THEN** the composer's textarea SHALL contain the prompt content with each `{{param}}` replaced by its entered value, and the popup (and any open browse modal) SHALL close

#### Scenario: Cancelling
- **WHEN** the user clicks Cancel in the "Prompt parameters" popup
- **THEN** the popup SHALL close, the composer's textarea SHALL be unchanged, and no favorite/selection state SHALL change

## Non-functional notes

- **State ownership**: favorite-prompt data is read from the existing `PromptsContext` (`usePrompts`) and `FavoriteApplicationsContext` (`useFavoriteApplications`); no new context is introduced. The new app-level hook `usePromptSelectorOverlay` (mirroring `useDeploymentSelectorOverlay`) owns the transient UI state (which popup/modal is open, in-flight parameter values).
- **Feature gating**: gated by `OverlayFeature.Prompts` via `useUiFeature`, matching `CatalogView`'s existing `isPromptsEnabled` gate. No new `ENABLED_FEATURES`/role key is introduced.
- **RTL/direction**: the back chevron (`IconChevronLeft`), used in both the Favorites panel header (desktop) and the Prompt parameters popup header, requires `rtl:scale-x-[-1]`; the star icon, close icon, and prompt icon are symmetric/conceptual and are not mirrored. All layout in the new lib components uses logical Tailwind classes (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`) per `.claude/rules/rtl.md`.
- **Accessibility**: favorite star buttons use `aria-pressed`; the "Prompt parameters" popup title and the Parameters/Details column headings use Heading typography (`dial-h2-text`); the close/back icon buttons carry `aria-label`s from i18n; decorative icons inside already-labeled controls (prompt icon, star icon glyph) are `aria-hidden`; per-field validation state (`Textarea` required) is exposed via standard HTML `required`/`aria-required` semantics rather than a custom validation message pattern.
- **Memoization**: the favorites list (`favoritePromptItems`), the parsed-parameter list (`extractPromptParams` result), and the menu item arrays passed into `AddAttachmentButton` SHALL be memoized (`useMemo`) keyed on their actual dependencies (`prompts`, `sharedWithMe`, `publicPrompts`, `favoriteIds`, selected prompt id/content), matching the existing memoization pattern in `useDeploymentSelectorOverlay`/`CatalogView`.
- **`libs/prompts` reuses `libs/catalog`'s public API directly** rather than duplicating it: `AppIdentity`, `CatalogEntityType`, `DeploymentSize`, and `ContentTab` are all exported from `libs/catalog`'s `index.ts` (added by this change) and consumed as a peer dependency by `libs/prompts`. `@nx/enforce-module-boundaries` in this repo does not restrict `type:ui` → `type:ui`/`publishable` imports (its one `depConstraints` entry allows any tag to depend on any tag), so no relocation into `chat-shared` was needed for these two components — only the token-grammar/highlighter pieces (`PROMPT_PARAM_PATTERN`, `rehypePromptVariables`, `MarkdownWithPlaceholders` — see the "Immediate insertion" requirement above and design.md §1) were moved, because those are consumed by both a `type:ui` lib (`libs/prompts`) and needed at the raw-string level `ContentTab` alone doesn't provide.
- **i18n keys**: added as `PromptSelectorI18nKeys` in `apps/chat/src/constants/translation-keys.ts` (namespace `promptSelector.*` in `en.json`) — `AddMenuLabel`, `MyCollectionLabel`, `EmptyHint`, `ModalTitle`, `ParametersTitle`, `CloseLabel`, `BackLabel`, `ParametersLabel`, `DetailsLabel`, `EnterValuePlaceholder` — reusing `ButtonsI18nKeys.Browse`/`ButtonsI18nKeys.Cancel`/`ButtonsI18nKeys.Confirm`/`FavoritesI18nKeys.RemoveFromFavorites` where applicable rather than duplicating them (no separate `promptLabel`/prompt-summary-label key exists — the summary card's "PROMPT" type text comes from `libs/catalog`'s reused `AppIdentity`/`EntityTypeLabel`, not from app i18n). The Favorites panel's back chevron (desktop only) reuses `PromptSelectorI18nKeys.BackLabel` rather than a separate key, since both are the same "Back" action.
- **No new backend endpoints or caches**: prompt content is already returned in full by the existing `listPrompts`/`listPublicPrompts` endpoints consumed by `PromptsContext`; no new generated-client method, DTO, or cache is introduced.
