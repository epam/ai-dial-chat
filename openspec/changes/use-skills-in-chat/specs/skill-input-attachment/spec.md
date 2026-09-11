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

### Requirement: Skill selection on all chat input surfaces

The skill-selection entry points — the Add-menu "Skills" item, the inline selected-skill chip with its Backspace-at-start removal, the slash command dropdown, the "Use skill" browse modal, and the "View details" details side panel — SHALL be available on every conversation-input surface in `apps/chat` that composes messages, not only the main chat route. This explicitly includes the AppsEditor preview chat (`AppPreviewChat`): its pre-conversation composer (the shared `NewConversationComposer`) SHALL offer the same entry points backed by the same host wiring (`useSkillSelectorOverlay`) and the same `features.skillUsageEnabled` gating, and the details side panel SHALL open on the AppsEditor surface exactly as it opens on the chat route. Once the preview conversation exists, its ongoing-conversation input is the shared `ConversationView` and needs no separate wiring. Message-composition paths that carry no user-composed draft (quick-app starter auto-submit) SHALL NOT attach a skill.

#### Scenario: Preview composer shows the entry points

- **WHEN** `features.skillUsageEnabled` is enabled and the AppsEditor preview chat's empty state is shown
- **THEN** the Add menu offers the "Skills" item, the slash dropdown and browse modal work, and a selected skill renders as the inline `ChatSkill` chip

#### Scenario: Feature flag disabled in the preview

- **WHEN** `features.skillUsageEnabled` is disabled and the AppsEditor preview chat's empty state is shown
- **THEN** the preview composer renders identically to before this capability — no "Skills" menu item, no slash dropdown, no inline chip

#### Scenario: Starter auto-submit carries no skill

- **WHEN** a quick-app starter with submit-on-click auto-creates the first preview conversation message
- **THEN** the created conversation's first user message carries no `skills` entry

#### Scenario: Details panel on the preview surface

- **WHEN** the user activates "View details" from the preview composer's skill flow
- **THEN** the skill details side panel opens on the AppsEditor surface with the same read-only content as on the chat route

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

Activating the "Skills" item (desktop hover/focus, mobile tap) opens a second-level panel with the same chrome the Prompts panel gets (desktop nested `Dropdown` submenu that stays open beside the main menu; mobile stacked bottom sheet with the shell's own back navigation). The panel SHALL contain, in order: a "My Collection" header, the list of the current user's favorite skills (personal, shared-with-me, and public sources — `favoriteIds` intersected against `SkillsContext`'s `skills` + `sharedWithMe` + `publicSkills`), a separator, and a "Browse" button (reusing the existing shared Browse i18n key). The header and "Browse" button SHALL always render, independent of whether the favorites list is empty. The panel SHALL be 280px wide wherever it renders (Add-menu submenu and slash dropdown alike — design-confirmed, replacing the earlier content-driven minimum width).

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

Each favorite-skill row in the Skills panel SHALL be wrapped in the ui-kit `InteractiveTooltip` (with `asChild`, so the row itself remains the trigger). The panel SHALL open on row hover or keyboard focus, place itself to the row's end side on desktop (kit-default Right placement, flipping with direction), and be reachable by Tab from the row. The open state SHALL be the kit's own uncontrolled behavior — the upgraded ui-kit's hover handling keeps the panel open while the pointer travels between the row and the panel, so no panel-managed open state or close timers exist. The app SHALL mount a portal container for these panels at its root (`<div id="interactive-tooltip-portal" />` in `apps/chat/src/main.tsx`): the kit portals every `InteractiveTooltip` panel through floating-ui into `document.getElementById('interactive-tooltip-portal')`, and with no such element in the document the panel silently renders nothing (this container serves every `InteractiveTooltip` in the app, including the prompts panel's migrated rows and the `ChatSkill` chip's tooltip). Its content SHALL be, top to bottom: the skill's description paragraph (a spinner while the fetch is in flight — see the lazy-resolution requirement below; the paragraph omitted entirely for a skill whose manifest has no description), and below it a link-style "View details" button (ui-kit `Button`, `variant Primary` + `appearance Link`, 24px total height via a `h-[24px]` override of the kit Standard button's 40px — its label class `dial-small-paragraph-semi-text`, 14px/24px semibold, is the design spec, so the kit's `ElementSize.Small` is not used — with `self-start` so it hugs the content's start edge instead of stretching across the panel) with an `IconEye` on its inline-start and its label from `skillSelector.viewDetailsLabel` ("View details"). The panel's max width on desktop SHALL be 550px (via the kit's `contentClassName`, overriding its 320px default). On a touch-only device the tooltip SHALL render nothing — the row still selects the skill on tap, and the row's accessible name SHALL never depend on the tooltip.

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

The "View details" action in a row's tooltip SHALL open a right-anchored side panel on the chat route showing the selected skill's details, composed from `DetailsPanel` exported by `@epam/ai-dial-catalog` (see the `skill-details-panel` delta) via a `SkillDetailsSidePanel` wrapper in `libs/skills`. The wrapper SHALL NOT wrap or mount the full `CatalogView` (no tab persistence, sort/filter, or page chrome). The host SHALL own the panel's open state and supply the `CatalogItem` (built with the existing `mapSkillToCatalogItem`), the details fetch (reusing the existing skill details resolution — manifest + file listing — not a duplicate), and close handling; the panel's content-first tab behavior for skills SHALL match the Catalog page's skill details. The panel SHALL render information-only — read-only (`isReadonly`, which withholds the favorite star and every mutating action: Share, Publish/Unpublish, Edit, Delete, "Remove from My List", "Revoke access", and the credentials actions) with the primary "Use in chat" action and Download also hidden. Selecting a skill SHALL stay with the favorites rows, the slash menu, the browse modal, and the Catalog page; favorite toggling SHALL stay with the favorites rows; the Catalog page's own `DetailsPanel` rendering SHALL keep its actions unchanged.

#### Scenario: Opening the side panel

- **WHEN** the user clicks "View details" in a favorite row's tooltip
- **THEN** the side panel opens anchored to the chat route's end edge, showing that skill's details with the content-first tabs and no action buttons

#### Scenario: Closing the side panel

- **WHEN** the user closes the side panel
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

The conversation input SHALL hold at most one selected skill at a time. When a skill is selected — from a favorite row in the Skills panel, from a card in the "Use skill" modal, from the slash command dropdown (below), or via the Catalog page's "Use in chat" on a skill (see the `catalog-use-in-chat` delta) — it SHALL become the selected skill, replacing any previously selected skill, and SHALL be rendered inside the input's text area as a `ChatSkill` element (next requirement). The Skills panel, browse modal, or slash dropdown the selection came from SHALL close. Selecting the skill that is already selected SHALL leave exactly one `ChatSkill` element (no duplicate, no churn). Removing the element via the input's Backspace-at-position-0 gesture (the "Selected skill renders inline inside the input" requirement below) SHALL clear the selection and change nothing else. What the selected skill means at send time (request payload, persistence in conversation history) is specified by the `skill-message-payload` capability.

#### Scenario: Selecting from favorites

- **WHEN** the user clicks a favorite skill row
- **THEN** the Skills panel closes and a `ChatSkill` element for that skill appears inside the conversation input's text area

#### Scenario: Selecting a different skill replaces the previous one

- **WHEN** a skill is already selected and the user selects a different skill
- **THEN** the input shows exactly one `ChatSkill` element, for the newly selected skill

#### Scenario: Selecting the already-selected skill is idempotent

- **WHEN** the user selects the skill that is already selected
- **THEN** the input still shows exactly one `ChatSkill` element for that skill

#### Scenario: Removing a selected skill

- **WHEN** the caret is collapsed at position 0 of the text area while a skill is selected and the user presses Backspace
- **THEN** the `ChatSkill` element is removed from the input, no skill is selected, and the message text is unchanged

---

### Requirement: `ChatSkill` inline component

`libs/skills` SHALL export a `ChatSkill` component that renders a single used skill: a ui-kit `GhostButton` whose visible label is `/` followed by the skill's name (e.g. `/my-skill`), wrapped in the ui-kit `InteractiveTooltip` (`asChild`, uncontrolled open on hover and keyboard focus, top placement by default (design-confirmed) flipping with direction — the favorite rows keep their end-side placement, 550px max panel width on desktop — the same panel the favorite-skill rows use). The component SHALL accept the skill's metadata — `name`, `description` (optional), `isDescriptionLoading` (spinner while a lazy fetch is in flight), and `path` (the skill's resource URL) — plus an `onViewDetails(path)` callback, an optional first-open notification `onTooltipOpen(path)` (the same lazy-description trigger the favorite rows use, so the host's fetch works wherever the component renders), a `labelClassName` typography override for the `/{name}` label (default `dial-body-paragraph-text`), and label overrides with English defaults. The button SHALL carry no remove control of its own — removal is the input's Backspace-at-start gesture (the "Selected skill renders inline inside the input" requirement below); its metrics SHALL be auto height with zero vertical padding and 8px horizontal padding (overriding the kit button's default `h-[40px] px-4` sizing — the kit's `ElementSize.Small` is not used here because it is a fixed 24px with tiny typography, not the chip's 26px line with its 16px label), so the chip's total height is exactly its label line (26px with the default `dial-body-paragraph-text` label). Activating the button body SHALL have no action of its own beyond opening the tooltip; the tooltip's content SHALL be the shared tooltip content component the favorite-skill rows render (description paragraph with its loading/absent states above the "View details" link button with `IconEye`), and "View details" SHALL invoke `onViewDetails(path)` and close the tooltip (the kit's tooltip is uncontrolled with no imperative close, so the click remounts it — the fresh instance starts closed; reopening takes a fresh hover or focus). On a touch-only device the tooltip SHALL render nothing and the button remains a non-action element. The same component SHALL be used in the conversation input and in the conversation history (see the `skill-message-payload` delta), so the skill's visual form is identical everywhere.

#### Scenario: Button label

- **WHEN** `ChatSkill` renders for a skill named "my-skill"
- **THEN** the button's visible label is `/my-skill`

#### Scenario: Tooltip on hover

- **WHEN** the pointer rests on the `ChatSkill` button and the skill's description is resolved
- **THEN** the interactive tooltip opens above the button showing the description above the "View details" button, and stays open while the pointer moves onto the panel

#### Scenario: Button body has no action

- **WHEN** the user clicks the `ChatSkill` button body
- **THEN** no selection, navigation, or send-time effect occurs — only the tooltip opens

#### Scenario: View details

- **WHEN** the user clicks "View details" in the `ChatSkill` tooltip
- **THEN** the host's `onViewDetails` receives the skill's path and the skill details side panel opens (chat route) or the catalog details open, per the host's wiring
- **AND** the tooltip closes immediately (the click remounts it; reopening takes a fresh hover or focus)

#### Scenario: Description still loading

- **WHEN** the tooltip opens while `isDescriptionLoading` is true
- **THEN** a spinner renders in the description's place, above the "View details" button

---

### Requirement: Selected skill renders inline inside the input

The selected skill SHALL be rendered inside the conversation input's text area, at its inline-start on the first text line — not outside the input and not below the text area — and the user SHALL be able to keep typing in the same input while the skill is selected. Typed text SHALL start after the `ChatSkill` element on the first line and wrapped lines SHALL use the text area's full width (the text flows around the element; lines after an explicit line break also use the full width). While the slot is present the input's placeholder SHALL be suppressed (the slot itself says what the input holds); the text area SHALL gain no extra block padding while the slot is present, so slot content whose height is one label line (the `ChatSkill` chip, which carries no vertical padding of its own) aligns with the first text line exactly. The mechanism SHALL be a generic `inlineStartSlot?: ReactNode` prop on `Input` (forwarded by `ConversationInput` and `EditMessageInput`) whose content the app supplies — `libs/conversation-input` SHALL NOT know about skills; the flow-around mechanics (slot positioning and the first-line indent of the text) SHALL be the lib's own generic behavior driven by the slot's measured width, using logical properties so RTL mirrors automatically. `Input` SHALL also expose `onInlineStartRemove?: () => void`, invoked when Backspace is pressed with the caret collapsed at position 0 while the slot is present — the slot's remove gesture (at position 0 a Backspace has nothing to delete backwards, so the keypress is suppressed and redirected to the slot; no text is affected) — and forwarded by `ConversationInput` and `EditMessageInput`. The slot's presence SHALL count as sendable content on its own: while a skill is selected the send button SHALL be mounted and enabled and the configured send gesture SHALL send even with an empty draft (the send-time payload carrying the skill is the `skill-message-payload` capability's concern); removing the skill with an empty draft SHALL disable sending again. The part-1 `selectedEntities`/`selectedEntityChipLabels` props and the `SelectedEntityChips` component SHALL be removed in the same change (the selected skill was their only consumer); all call sites migrate to the slot.

#### Scenario: Skill inside the input with typed text

- **WHEN** a skill is selected and the user types "summarize this"
- **THEN** the `ChatSkill` element renders at the inline-start of the text area and the typed text begins after it on the same line

#### Scenario: Skill selected with an empty draft

- **WHEN** a skill is selected and the text area is empty
- **THEN** the send button is mounted and enabled, and the configured send gesture (Enter or its meta-key variant) sends the message with the skill in its payload per the `skill-message-payload` capability

#### Scenario: Skill removed with an empty draft

- **WHEN** a skill is selected, the text area is empty, and the user removes the skill with the Backspace-at-position-0 gesture
- **THEN** sending is disabled again until text or an attachment provides sendable content

#### Scenario: Text wraps at full width

- **WHEN** the typed text is long enough to wrap
- **THEN** lines after the first use the text area's full width, flowing under the `ChatSkill` element

#### Scenario: No skill selected

- **WHEN** no skill is selected
- **THEN** the text area renders byte-identically to an input without the slot mechanism (no indent, no placeholder shift)

#### Scenario: RTL layout

- **WHEN** the document direction is RTL and a skill is selected
- **THEN** the `ChatSkill` element renders at the inline-start (right) edge of the text area and the first text line indents from the same edge

#### Scenario: No domain knowledge in the lib

- **WHEN** `libs/conversation-input` is linted and type-checked
- **THEN** no source file references skills or any catalog entity type in the slot mechanism

---

### Requirement: Slash command dropdown

When the input's text is empty and the user types `/`, a dropdown SHALL open above the input, anchored to the text area (top-start placement, flipping with direction). Its content SHALL be the same favorites panel the Skills Add-menu submenu shows — "My Collection" header, the user's favorite skill rows (with star toggles), a separator, and a "Browse" button — rendered by the same `FavoriteSkillsPanel` component with an optional `searchQuery` filter: the characters typed after the `/` SHALL filter the rows by case-insensitive name-substring, and each surviving row's name SHALL render its matched text through the shared `Highlight` component. A query matching no row SHALL show a "No matching skills" hint (announced via an `aria-live` status region) in place of the list, with the header and Browse still rendered. The dropdown panel SHALL be 280px wide, and the overlay SHALL size to that panel rather than the text area's width (`matchReferenceWidth={false}` on the kit `Dropdown` — the kit default stretches the popup to the reference width). The mechanism SHALL be a generic `commandMenu` config on `Input` (trigger prefix + host-supplied `renderMenu` + optional `emptyQueryHint`) — `libs/conversation-input` owns only the trigger state machine and the dropdown chrome, and SHALL NOT know about skills.

While the dropdown is open with an empty query (the text area holds exactly the `/`), the config's `emptyQueryHint` — the app passes `skillSelector.emptyQueryHint` ("Type to filter") — SHALL render inside the text area immediately after the `/`, in the placeholder style: an `aria-hidden` overlay anchored at the first line's text start (the same offset the first line's indent uses, so it follows an inline-start slot when one is present), with an invisible mirror of the trigger prefix occupying exactly the prefix's rendered width ahead of the hint so no width measurement is needed. The hint SHALL disappear with the first query keystroke. The hint's appearance and disappearance SHALL NOT remount the text area: the overlay wrapper hosting the hint (the same wrapper that hosts the inline-start slot) is driven by the hint's configuration, not by the live menu/query state, so focus and the caret are preserved while typing — the caret stays where the user typed (after the `/` and any query characters), never reset to the text start.

The dropdown SHALL stay open while the message continues to match a `/` followed by a whitespace-free, slash-free query. It SHALL close when the message stops matching (the `/` deleted, a space or second `/` typed), on Escape, and on outside click (a click back into the text area does not count as outside). If the user dismisses it with Escape or an outside click while the message still matches, it SHALL NOT reopen on subsequent keystrokes; it SHALL reopen only after the message stops matching and the user enters the trigger into the empty input again — by typing `/` or by pasting a trigger-shaped value (below).

Pasting into the text area SHALL trigger the dropdown by the resulting value, not by the keystroke path: a paste made while the text area is empty whose result is exactly the trigger shape — the bare `/`, or `/` followed by a whitespace-free, slash-free query and nothing else — SHALL open the dropdown as if the same text had been typed: same query filter, same "Type to filter" empty-query hint for a bare `/`, same dismissal and selection rules. The paste SHALL insert its text as an ordinary paste; the trigger only opens the dropdown on top of the inserted text and SHALL NOT alter, trim, or consume it. Any paste whose result is not that exact shape — content containing whitespace after the query token (e.g. `/s sdf`), multiple lines, trailing text, or content not starting with `/` — SHALL be a regular paste that opens nothing. The paste trigger applies only when the text area was empty before the paste; pasting `/test` into an input that already holds text never opens the dropdown. A paste that brings the message into the trigger shape from a non-matching value re-enters the trigger for the dismissed-dropdown rule above: a dropdown dismissed earlier SHALL reopen when the user clears the input and pastes a fresh `/query`. This trigger lives in the generic `commandMenu` mechanism on `Input`, so it behaves identically on every input surface where the command menu is mounted — the new-conversation composer (main chat and AppsEditor preview) and the ongoing-conversation input.

Selecting a row from the dropdown SHALL consume the slash text — the entire `/query` string is removed from the input and never sent — select the skill (single-selection rule above), and return focus to the text area (a mouse selection moves focus to the row, which unmounts when the dropdown closes; keyboard selection never left the text area). Activating Browse SHALL likewise consume the slash text and open the "Use skill" browse modal. The Add-menu "Skills" item SHALL remain available unchanged alongside this entry point. The slash dropdown SHALL render only when the `features.skillUsageEnabled` flag is enabled.

#### Scenario: Typing "/" in an empty input

- **WHEN** the input text is empty and the user types `/`
- **THEN** the dropdown opens above the input showing the favorites panel content, and a placeholder-styled "Type to filter" hint renders in the text area right after the `/`

#### Scenario: Filtering while typing

- **WHEN** the dropdown is open and the user types `my` after the `/`
- **THEN** only favorite skills whose names contain "my" (case-insensitive) render, with the matched substring highlighted, and the "Type to filter" hint no longer renders

#### Scenario: Focus and caret are preserved while typing

- **WHEN** the user types `/` into the empty input and then types query characters
- **THEN** focus stays in the text area throughout and the caret remains at the end of the typed text — the text area is not remounted when the menu opens, when the hint appears, or when the hint disappears with the first query keystroke

#### Scenario: No matches

- **WHEN** the query matches no favorite skill
- **THEN** the list area shows the "No matching skills" hint, and the header and Browse button still render

#### Scenario: Deleting the slash

- **WHEN** the dropdown is open and the user deletes the `/`
- **THEN** the dropdown closes

#### Scenario: Dismissed until re-entered

- **WHEN** the user closes the open dropdown with Escape (or an outside click) while the message still reads `/my`, then types more characters
- **THEN** the dropdown stays closed
- **AND WHEN** the user deletes the text back to empty and types `/` again
- **THEN** the dropdown reopens

#### Scenario: Selecting from the dropdown

- **WHEN** the user picks a skill row in the slash dropdown (mouse or keyboard)
- **THEN** the `/query` text is removed from the input, the dropdown closes, the skill becomes the input's selected skill rendered as `ChatSkill`, and focus is in the text area

#### Scenario: Space or second slash ends the session

- **WHEN** the message is `/my` and the user types a space (or a second `/`)
- **THEN** the dropdown closes and does not reopen on further typing

#### Scenario: Pasting a slash command into an empty input

- **WHEN** the input text is empty and the user pastes `/test`
- **THEN** the dropdown opens with "test" as the filter, the pasted text stays in the input as an ordinary paste, and every open-dropdown behavior (filtering, hint, dismissal, selection) applies exactly as if the text had been typed

#### Scenario: Pasting a bare slash

- **WHEN** the input text is empty and the user pastes `/`
- **THEN** the dropdown opens with an empty query and the "Type to filter" hint renders in the text area after the `/`

#### Scenario: Pasting non-command text is a regular paste

- **WHEN** the input text is empty and the user pastes `/s sdf` (whitespace inside the pasted value) or any content that is not a bare `/` plus a whitespace-free query
- **THEN** no dropdown opens and the paste lands as a regular paste

#### Scenario: Pasting into a non-empty input

- **WHEN** the input already holds text and the user pastes `/test`
- **THEN** no dropdown opens — the paste trigger requires an empty text area before the paste

#### Scenario: Re-entry after dismissal via paste

- **WHEN** the user dismissed the open dropdown with Escape while the message still matched, then deletes the text back to empty and pastes `/my`
- **THEN** the dropdown opens again

#### Scenario: Feature flag disabled

- **WHEN** `features.skillUsageEnabled` is disabled
- **THEN** typing or pasting `/` in an empty input opens nothing

---

### Requirement: Library boundaries for the skill-selection UI

The host-agnostic skill-selection UI SHALL live in a new `libs/skills` (`@epam/ai-dial-skills`) library — the favorites panel (rows wrapped in the ui-kit `InteractiveTooltip`, plus the optional `searchQuery` filter mode the slash dropdown uses), the shared tooltip content component the rows and `ChatSkill` render, the `ChatSkill` inline component itself, the `SkillDetailsSidePanel` wrapper composing `@epam/ai-dial-catalog`'s exported `DetailsPanel` (the lib peers on `@epam/ai-dial-catalog`), and the `FavoriteSkillItem` model. App-owned wiring SHALL stay in `apps/chat`: a `useSkillSelectorOverlay` hook (mirroring `usePromptSelectorOverlay`) that reads `SkillsContext`/`FavoriteApplicationsContext`, owns the modal, selection, and side-panel state, performs the lazy description fetch, and hands `libs/conversation-input` the generic overlay config, the slash `commandMenu` config, and the `ChatSkill` element for the input's `inlineStartSlot`. Neither library SHALL read the feature flag itself, import app contexts, i18n, routing, or server-api modules; all strings arrive as props with English defaults, description data arrives via callbacks/state, and flag resolution happens in the app.

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
- The tooltip's "View details" button SHALL take its accessible name from its visible label (`skillSelector.viewDetailsLabel`); the row's accessible name SHALL come from the skill name alone, never from tooltip content. The `ChatSkill` button's accessible name SHALL be its visible `/{name}` label.
- The `ChatSkill` button SHALL be reachable via Tab and announced by its visible `/{name}` label. Removal SHALL be the Backspace-at-position-0 gesture in the text area — keyboard-operable by construction, needing no separate control or accessible name of its own.
- The slash dropdown's menu region SHALL carry an accessible name (the host-supplied "Skills" label), its rows SHALL be keyboard-reachable, and the "No matching skills" state SHALL be announced through an `aria-live` status region.

#### Scenario: Keyboard removal of a selected skill

- **WHEN** the focus is in the text area with the caret collapsed at position 0 while a skill is selected and the user presses Backspace
- **THEN** the skill is removed from the input and the message text is unchanged

---

### Requirement: i18n keys

The following app i18n keys SHALL be added under the `skillSelector` namespace in `apps/chat/src/i18n/locales/en.json` and the `SkillSelectorI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`: `addMenuLabel` ("Skills"), `emptyHint` ("Star a skill to pin it here"), `modalTitle` ("Use skill"), `viewDetailsLabel` ("View details" — verified absent from `en.json`, so a feature-scoped key is correct), `noMatchingSkillsLabel` ("No matching skills" — slash-dropdown filtered-out state; verify absence from `en.json` first), and `emptyQueryHint` ("Type to filter" — the slash dropdown's empty-query hint rendered in the text area; verified absent from `en.json`). Shared-value strings ("My Collection", "Browse", "Back", "Remove from favorites") SHALL reuse the existing keys that already carry those values rather than gaining same-value `skillSelector.*` copies, per the duplicate-translation-value rule. The `ChatSkill` carries no remove control, so no remove-control label key is needed (removal is the input's Backspace gesture, which has no visible text).

#### Scenario: Labels use i18n values

- **WHEN** the Skills menu renders in a locale that has translated `skillSelector.addMenuLabel`
- **THEN** the menu item displays the translated label

---

### Requirement: No new backend endpoints

The capability SHALL NOT introduce new backend endpoints, generated-client methods, DTOs, or caches. Skill listing, details (manifest + file listing), favorites, and the tooltip's lazy description fetch (which reuses the existing skill-file download endpoint) flow through the existing skills and user-config endpoints the catalog already consumes.

#### Scenario: No API surface changes

- **WHEN** the change is complete
- **THEN** the generated OpenAPI client and the chat-api controllers are unchanged
