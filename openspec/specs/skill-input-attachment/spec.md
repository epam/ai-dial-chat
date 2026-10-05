# skill-input-attachment Specification

## Purpose

How skills are attached to the conversation input: the Skills entry in the Add menu, the favorites panel with its browse modal and lazy descriptions, the inline `/{name}` skill mentions rendered as `ChatSkill` with whole-mention Backspace removal, the slash-command dropdown, and the mention-tracking, library-boundary, RTL, accessibility, and i18n contract of that UI.
## Requirements
### Requirement: Skills entry in the Add menu

The Input's Add (`+`) menu SHALL show a "Skills" item (icon `IconBlocks`, i18n key `SkillSelectorI18nKeys.AddMenuLabel` (`skillSelector.addMenuLabel`) default "Skills") positioned directly below the "Prompts" item (or, when Prompts is absent, directly above "Chat settings"), on both the desktop dropdown and the mobile bottom sheet. The favorite-skill data backing this item SHALL come from the already-loaded `SkillsContext` and `FavoriteApplicationsContext` state — no fetch is triggered by opening the menu.

#### Scenario: Menu opened

- **WHEN** the user opens the Add menu
- **THEN** a "Skills" item with `IconBlocks` SHALL appear directly below the "Prompts" item and above "Chat settings"

---

### Requirement: Skill selection on all chat input surfaces

The skill-selection entry points — the Add-menu "Skills" item, the inline skill mentions with their whole-mention Backspace removal, the slash command dropdown, the "Use skill" browse modal, and the "View details" details side panel — SHALL be available on every conversation-input surface in `apps/chat` that composes messages, not only the main chat route. This explicitly includes the AppsEditor preview chat (`AppPreviewChat`): its pre-conversation composer (the shared `NewConversationComposer`) SHALL offer the same entry points backed by the same host wiring (`useSkillSelectorOverlay`), and the details side panel SHALL open on the AppsEditor surface exactly as it opens on the chat route. Once the preview conversation exists, its ongoing-conversation input is the shared `ConversationView` and needs no separate wiring. Message-composition paths that carry no user-composed draft (quick-app starter auto-submit) SHALL NOT attach a skill.

#### Scenario: Preview composer shows the entry points

- **WHEN** the AppsEditor preview chat's empty state is shown
- **THEN** the Add menu offers the "Skills" item, the slash dropdown and browse modal work, and a selected skill's mention renders as an inline `ChatSkill` chip

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

Activating the "Skills" item (desktop hover/focus, mobile tap) opens a second-level panel with the same chrome the Prompts panel gets (desktop nested `Dropdown` submenu that stays open beside the main menu; mobile stacked bottom sheet with the shell's own back navigation). The panel SHALL contain, in order: a "My Collection" header, the list of the current user's favorite skills (personal, shared-with-me, and public sources — `favoriteIds` intersected against `SkillsContext`'s `skills` + `sharedWithMe` + `publicSkills`), a separator, and a "Browse" button (reusing the existing shared Browse i18n key). The header and "Browse" button SHALL always render, independent of whether the favorites list is empty. The panel SHALL be 280px wide on desktop wherever it renders (Add-menu submenu and slash dropdown alike — design-confirmed, replacing the earlier content-driven minimum width); below the desktop breakpoint it SHALL fill its container instead, so the mobile Add-menu's stacked bottom sheet renders the list full-width — the desktop popover width is not a mobile constraint (user-reported mobile fix).

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

Each favorite-skill row in the Skills panel SHALL be wrapped in the ui-kit `InteractiveTooltip` (with `asChild`, so the row itself remains the trigger). The panel SHALL open on row hover or keyboard focus, place itself to the row's end side on desktop (kit-default Right placement, flipping with direction), and be reachable by Tab from the row in the Add-menu panel (in the slash dropdown the "View details" button leaves the Tab sequence — see the slash-dropdown keyboard requirement below). The open state SHALL be the kit's own uncontrolled behavior — the upgraded ui-kit's hover handling keeps the panel open while the pointer travels between the row and the panel, so no panel-managed open state or close timers exist. The app SHALL mount a portal container for these panels at its root (`<div id="interactive-tooltip-portal" />` in `apps/chat/src/main.tsx`): the kit portals every `InteractiveTooltip` panel through floating-ui into `document.getElementById('interactive-tooltip-portal')`, and with no such element in the document the panel silently renders nothing (this container serves every `InteractiveTooltip` in the app, including the prompts panel's migrated rows and the `ChatSkill` chip's tooltip). Its content SHALL be, top to bottom: the skill's description paragraph (the listing's `description` value — see the description-from-listing requirement; the paragraph omitted entirely for a skill whose listing entry carries no description), and below it a link-style "View details" button (ui-kit `Button`, `variant Primary` + `appearance Link`, 24px total height via a `h-[24px]` override of the kit Standard button's 40px — its label class `dial-small-paragraph-semi-text`, 14px/24px semibold, is the design spec, so the kit's `ElementSize.Small` is not used — with `self-start` so it hugs the content's start edge instead of stretching across the panel) with an `IconEye` on its inline-start and its label from `skillSelector.viewDetailsLabel` ("View details"). The panel's max width on desktop SHALL be 550px (via the kit's `contentClassName`, overriding its 320px default). On a touch-only device the tooltip SHALL render nothing — the row still selects the skill on tap, and the row's accessible name SHALL never depend on the tooltip.

Clicking "View details" SHALL open the skill details side panel (next requirement) and close the Add menu and its tooltip.

#### Scenario: Hover with a listing description

- **WHEN** the pointer rests on a favorite row whose listing entry carries a description
- **THEN** the interactive tooltip opens beside the row showing the description above the "View details" button
- **AND** it stays open while the pointer moves onto the panel itself
- **AND** no request is issued to resolve the description

#### Scenario: Skill whose listing carries no description

- **WHEN** a skill's listing entry has no `description`
- **THEN** the panel shows the "View details" button alone on every open, with no error surfaced

#### Scenario: Touch-only device

- **WHEN** the Skills panel is used on a touch-only device
- **THEN** no tooltip renders, and tapping the row still selects the skill

#### Scenario: "View details" click

- **WHEN** the user clicks "View details" in a row's tooltip
- **THEN** the skill details side panel opens for that skill and the Add menu and tooltip close

### Requirement: "View details" opens the skill details side panel

The "View details" action in a row's tooltip SHALL open a right-anchored side panel on the chat route showing the selected skill's details, composed from `DetailsPanel` exported by `@epam/ai-dial-catalog` (see the `skill-details-panel` delta) via a `SkillDetailsSidePanel` wrapper in `libs/skills`. The wrapper SHALL NOT wrap or mount the full `CatalogView` (no tab persistence, sort/filter, or page chrome). The host SHALL own the panel's open state and supply the `CatalogItem` (built with the existing `mapSkillToCatalogItem`), the details fetch (reusing the existing skill details resolution — manifest + file listing — not a duplicate), and close handling; the panel's content-first tab behavior for skills SHALL match the Catalog page's skill details. The panel SHALL render information-only — read-only (`isReadonly`, which withholds the favorite star and every mutating action: Share, Publish/Unpublish, Edit, Delete, "Remove from My List", "Revoke access", and the credentials actions) with the primary "Use in chat" action and Download also hidden. Selecting a skill SHALL stay with the favorites rows, the slash menu, the browse modal, and the Catalog page; favorite toggling SHALL stay with the favorites rows; the Catalog page's own `DetailsPanel` rendering SHALL keep its actions unchanged.

The app-owned `SkillDetailsPanelContainer` SHALL close the global attachment canvas through `useAttachmentCanvas().closeCanvas` when a non-null skill is selected for details. This applies to "View details" from conversation skill mentions as well as the skill-selection UI, on both mobile and desktop, whether the attachment preview is displaying content or still loading. The details panel and its backdrop SHALL be visible without the previous file preview covering the panel. A mounted details container with no selected skill SHALL NOT close an attachment preview. This panel coordination SHALL remain in `apps/chat`, outside the reusable skill components.

#### Scenario: Opening the side panel

- **WHEN** the user clicks "View details" in a favorite row's tooltip
- **THEN** the side panel opens anchored to the chat route's end edge, showing that skill's details with the content-first tabs and no action buttons

#### Scenario: Opening skill details while a generated attachment is previewed

- **GIVEN** a conversation contains a skill-generated attachment and its file preview is open
- **WHEN** the user activates "View details" from a skill's tooltip in the conversation
- **THEN** the attachment preview closes and the background darkens behind the visible skill details panel
- **AND** the previous file preview does not cover the details content

#### Scenario: Opening skill details while an attachment preview is loading

- **GIVEN** the global attachment canvas is open in its loading state
- **WHEN** the user activates "View details" for a skill
- **THEN** the attachment canvas closes and its loading state clears as the skill details panel opens

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

The conversation input SHALL track skills as an ordered list of mentions inside the draft text, not as a single selection. `useSkillMentions` (`libs/skills`) SHALL keep the plain-text `draft` plus ordered `anchors` (`{ url, name, start, length }`), each marking a literal `/{name}` run in the draft, and SHALL expose them at send time as `orderedSkills` (`RequestSkill[]` in left-to-right order, `undefined` when there are none), which hosts send as `custom_content.skills`. When a skill is selected — from a favorite row in the Skills panel, from a card in the "Use skill" modal, or from the slash command dropdown (below) — its `/{name}` text SHALL be inserted at the caret (with a trailing space only when the caret is not already followed by whitespace) and tracked as a new anchor, alongside any mentions already present; the caret SHALL be placed right after the inserted run. The Catalog page's "Use in chat" on a skill (see `catalog-use-in-chat`) goes through the app hook's `selectSkillByUrl`, which seeds the draft with `/{name} ` and that single mention. Selecting a skill that is already mentioned SHALL add another mention; mentions are not de-duplicated. The Skills panel, browse modal, or slash dropdown the selection came from SHALL close. Each anchor SHALL be reconciled on every draft edit: edits before it shift it, and an edit that overlaps its run drops the anchor, leaving the text as plain text. What the mentions mean at send time (request payload, persistence in conversation history) is specified by the `skill-message-payload` capability.

#### Scenario: Selecting from favorites

- **WHEN** the user clicks a favorite skill row
- **THEN** the Skills panel closes and the skill's `/{name}` mention is inserted at the caret and rendered as a `ChatSkill` element inside the conversation input's text area

#### Scenario: Selecting a different skill adds a second mention

- **WHEN** a skill is already mentioned and the user selects a different skill with the caret elsewhere in the draft
- **THEN** the input shows both mentions as `ChatSkill` elements, and `orderedSkills` lists them in their left-to-right order in the draft

#### Scenario: Editing inside a mention turns it into plain text

- **WHEN** the user types or deletes a character inside a mention's `/{name}` run
- **THEN** that anchor is dropped, the text stays as typed, and the skill is no longer in `orderedSkills`

#### Scenario: Removing a mention

- **WHEN** the caret is collapsed exactly at the end of a mention's `/{name}` run and the user presses Backspace
- **THEN** the whole `/{name}` run is deleted in one edit, its anchor is dropped, and the rest of the draft and the other mentions are unchanged

---

### Requirement: `ChatSkill` inline component

`libs/skills` SHALL export a `ChatSkill` component that renders a single used skill (one mention): a focusable (`tabIndex={0}`) inline text `<span>` with `aria-label` `/{name}` whose visible text is `/` followed by the skill's name (e.g. `/my-skill`), sized to the same width as the raw `/{name}` text so the composer mirror can overlay it on the real textarea text, wrapped in the ui-kit `InteractiveTooltip` (`asChild`, `TooltipPlacement.Top` flipping with direction — the favorite rows keep their end-side placement — and a 550px max panel width via `contentClassName`). The component SHALL accept the skill's metadata — `name`, `description` (optional — the listing's value, rendered directly with no fetch), and `path` (the skill's resource URL) — plus an `onViewDetails(path)` callback, an optional `isUnsupported` flag selecting the error state (see the error-state requirement), an optional `unresolvedReason` (`SkillUnresolvedReason.Deleted` or `NotShared`) for a url that resolved to no loaded listing entry, a `detailsTrigger` of `'hover'` (default: uncontrolled tooltip opening on hover and keyboard focus) or `'click'` (controlled tooltip opening on click or Enter/Space), a `labelClassName` for the `/{name}` label (default `dial-body-paragraph-text text-accent`), an `unsupportedLabelClassName` color added to the label in the error state (default `text-error`), an `unsupportedClassName` added to the chip in the error state (default `bg-error`), and `labels` overrides with English defaults (`viewDetailsLabel`, `unsupportedTooltipLabel`, `deletedTooltipLabel`, `notSharedTooltipLabel`). The chip SHALL carry no remove control of its own — removal is the input's whole-mention Backspace gesture (the "Selected skill renders inline inside the input" requirement below). Activating the chip SHALL have no action of its own beyond opening the tooltip. The tooltip's content SHALL be the shared `SkillInfoTooltipContent` component the favorite-skill rows render, chosen in this order: when `unresolvedReason` is set, a fixed icon plus the deleted (trash-can icon) or not-shared (lock icon) message alone; otherwise when `isUnsupported` is set, the unsupported-model message alone; otherwise the description paragraph (omitted when absent) above the "View details" link button with `IconEye`. "View details" SHALL invoke `onViewDetails(path)` and close the tooltip (the click remounts it, so the fresh instance starts closed; reopening takes a fresh hover, focus, or click). The same component SHALL be used in the conversation input and in the conversation history (see `skill-message-payload`), so the skill's visual form is identical everywhere; history rendering passes `unresolvedReason` but never `isUnsupported`.

#### Scenario: Chip label

- **WHEN** `ChatSkill` renders for a skill named "my-skill"
- **THEN** the chip's visible text and accessible name are `/my-skill`

#### Scenario: Tooltip on hover

- **WHEN** `detailsTrigger` is `'hover'`, the pointer rests on the `ChatSkill` chip, and the skill's listing entry carries a description
- **THEN** the interactive tooltip opens above the chip showing the description above the "View details" button, and stays open while the pointer moves onto the panel

#### Scenario: Chip body has no action

- **WHEN** the user clicks the `ChatSkill` chip
- **THEN** no selection, navigation, or send-time effect occurs — only the tooltip opens

#### Scenario: View details

- **WHEN** the user clicks "View details" in the `ChatSkill` tooltip
- **THEN** the host's `onViewDetails` receives the skill's path and the skill details side panel opens (chat route) or the catalog details open, per the host's wiring
- **AND** the tooltip closes immediately (the click remounts it; reopening takes a fresh hover, focus, or click)

#### Scenario: Unsupported state tooltip

- **WHEN** `ChatSkill` renders with `isUnsupported` and the tooltip opens
- **THEN** the tooltip shows the unsupported-model message alone — no description paragraph and no "View details" button — the `/{name}` label carries the error color, and the chip carries `unsupportedClassName` (default `bg-error`)

#### Scenario: Unresolved skill tooltip

- **WHEN** `ChatSkill` renders with `unresolvedReason` set to `SkillUnresolvedReason.Deleted` or `SkillUnresolvedReason.NotShared`
- **THEN** the tooltip shows only that reason's icon and message (trash can with the deleted message, or lock with the not-shared message), taking precedence over `isUnsupported`, with no description and no "View details" button

#### Scenario: Click-triggered details

- **WHEN** `ChatSkill` renders with `detailsTrigger: 'click'` and the user clicks the chip or presses Enter or Space on it
- **THEN** the tooltip opens; hovering alone does not open it

### Requirement: Selected skill renders inline inside the input

Every tracked skill mention SHALL be rendered inside the conversation input's text area, at the position of its own `/{name}` text, and the user SHALL be able to keep typing anywhere in the same input around the mentions. The mechanism SHALL be generic props on `Input` (forwarded by `ConversationInput` and `EditMessageInput`), and `libs/conversation-input` SHALL NOT know about skills:

- `activeMentions?: HighlightedTextRange[]` — ranges (`start`, `length`, optional `isUnsupported`, optional `render()`) of `message` to draw highlighted. While at least one range is present, the textarea's own text is rendered transparent (its caret stays visible) and a non-interactive, `aria-hidden` mirror underneath renders the same text with each range wrapped in a highlight span, so highlights stay pixel-aligned with the real characters. A range with `render` is drawn by the host's node instead, which keeps real pointer events and sits outside `aria-hidden`. The skills hook passes one range per anchor, rendered through `ChatSkill` (with `isUnsupported` while the deployment does not support skills, and the host's `activeMentionDetailsTrigger`). With no ranges, the text area renders unchanged with normal text.
- `onBackspaceAtCaret?: (caretPosition) => HighlightedTextRange | undefined` — on Backspace with a collapsed caret, `Input` asks the host whether a tracked range ends exactly there; when one does, `Input` deletes that whole range in one native edit (`document.execCommand('delete')`, preserving undo, with a value fallback) instead of the default single-character deletion. `useSkillMentions.onBackspaceAtCaret` answers from its anchors; the resulting draft change drops the anchor.

Because each mention is literal `/{name}` text in the draft, the draft is never empty while a mention is present: the native placeholder stays hidden, the send button is mounted and enabled, and the configured send gesture sends (the payload is the `skill-message-payload` capability's concern) — except while the mention is unsupported, when the send button stays mounted but disabled per the error-state requirement below. Removing the last mention from an otherwise empty draft disables sending again.

#### Scenario: Mention inside the input with typed text

- **WHEN** a skill is selected and the user types "summarize this" after it
- **THEN** the mention renders as a `ChatSkill` element over its `/{name}` text and the typed text continues after it in the same text flow

#### Scenario: Mention with no other text

- **WHEN** the draft holds only a skill mention
- **THEN** the send button is mounted and enabled, and the configured send gesture (Enter or its meta-key variant) sends the message with the skill in its payload per the `skill-message-payload` capability

#### Scenario: Unsupported mention with no other text

- **WHEN** the draft holds only a skill mention and the current deployment does not support skills
- **THEN** the send button is mounted but disabled, and the configured send gesture does not send

#### Scenario: Mention removed from an otherwise empty draft

- **WHEN** the draft holds only a skill mention and the user presses Backspace with the caret at the end of its `/{name}` run
- **THEN** the whole run is deleted and sending is disabled again until text or an attachment provides sendable content

#### Scenario: No mentions

- **WHEN** `activeMentions` is absent or empty
- **THEN** the text area renders with normal, non-transparent text and no highlight mirror styling

#### Scenario: RTL layout

- **WHEN** the document direction is RTL and the draft holds a mention
- **THEN** the mirror follows the text area's own direction, so the `ChatSkill` element stays over its `/{name}` text

#### Scenario: No domain knowledge in the lib

- **WHEN** `libs/conversation-input` is linted and type-checked
- **THEN** no source file references skills or any catalog entity type in the `activeMentions`/`onBackspaceAtCaret` mechanism

### Requirement: Slash command dropdown

When the input's text is empty and the user types `/`, a dropdown SHALL open above the input, anchored to the text area (top-start placement, flipping with direction). Its content SHALL be the same favorites panel the Skills Add-menu submenu shows — "My Collection" header, the user's favorite skill rows (with star toggles), a separator, and a "Browse" button — rendered by the same `FavoriteSkillsPanel` component with an optional `searchQuery` filter: the characters typed after the `/` SHALL filter the rows by case-insensitive name-substring, and each surviving row's name SHALL render its matched text through the shared `Highlight` component. A query matching no row SHALL show a "No matching skills" hint (announced via an `aria-live` status region) in place of the list, with the header and Browse still rendered. The dropdown panel SHALL be 280px wide on desktop (below the desktop breakpoint it fills the overlay, which sizes to the panel's content within its viewport cap), and the overlay SHALL size to that panel rather than the text area's width (`matchReferenceWidth={false}` on the kit `Dropdown` — the kit default stretches the popup to the reference width). The mechanism SHALL be a generic `commandMenu` config on `Input` (trigger prefix + host-supplied `renderMenu` + optional `emptyQueryHint`) — `libs/conversation-input` owns only the trigger state machine and the dropdown chrome, and SHALL NOT know about skills.

While the dropdown is open with an empty query (the text area holds exactly the `/`), the config's `emptyQueryHint` — the app passes `skillSelector.emptyQueryHint` ("Type to filter") — SHALL render inside the text area immediately after the `/`, in the placeholder style: an `aria-hidden` span spliced into the highlight mirror (the same mirror that renders `activeMentions`) as inline content right after the trigger, so it sits after the `/` with no width measurement and never pushes real text; it is suppressed while the trigger's line has more text after it. The hint SHALL disappear with the first query keystroke. The hint's appearance and disappearance SHALL NOT remount the text area: the textarea's wrapper is driven by the hint's configuration, not by the live menu/query state, so focus and the caret are preserved while typing — the caret stays where the user typed (after the `/` and any query characters), never reset to the text start.

The dropdown SHALL stay open while the message continues to match a `/` followed by a whitespace-free, slash-free query. It SHALL close when the message stops matching (the `/` deleted, a space or second `/` typed), on Escape, and on outside click (a click back into the text area does not count as outside). Escape and outside click are not the same dismissal: Escape latches — if the user dismisses with Escape while the message still matches, the dropdown SHALL NOT reopen on subsequent keystrokes or caret moves; it SHALL reopen only after the message stops matching and the user enters the trigger into the empty input again (by typing `/` or by pasting a trigger-shaped value, below). An outside click does not latch — it closes the dropdown for the moment only, and the dropdown SHALL reopen with no need to retype the trigger as soon as the caret is back in the same still-matching `/query`: by editing it further (typing or deleting), by refocusing the text area (a click back in, or Tab), or by moving the caret into it with the keyboard (arrow keys, Home/End, Page Up/Down) while already focused. When the message holds more than one `/`-shaped run at once, the dropdown SHALL always belong to whichever one the caret is actually in — re-evaluated on every caret move, not remembered from whichever run last drove typing — and SHALL close when the caret leaves it for plain text or a different run, honoring that other run's own Escape latch if it has one.

Pasting into the text area SHALL trigger the dropdown by the resulting value, not by the keystroke path: a paste made while the text area is empty whose result is exactly the trigger shape — the bare `/`, or `/` followed by a whitespace-free, slash-free query and nothing else — SHALL open the dropdown as if the same text had been typed: same query filter, same "Type to filter" empty-query hint for a bare `/`, same dismissal and selection rules. The paste SHALL insert its text as an ordinary paste; the trigger only opens the dropdown on top of the inserted text and SHALL NOT alter, trim, or consume it. Any paste whose result is not that exact shape — content containing whitespace after the query token (e.g. `/s sdf`), multiple lines, trailing text, or content not starting with `/` — SHALL be a regular paste that opens nothing. The paste trigger applies only when the text area was empty before the paste; pasting `/test` into an input that already holds text never opens the dropdown. A paste that brings the message into the trigger shape from a non-matching value re-enters the trigger for the dismissed-dropdown rule above: a dropdown dismissed earlier SHALL reopen when the user clears the input and pastes a fresh `/query`. This trigger lives in the generic `commandMenu` mechanism on `Input`, so it behaves identically on every input surface where the command menu is mounted — the new-conversation composer (main chat and AppsEditor preview) and the ongoing-conversation input.

Selecting a row from the dropdown SHALL consume the slash text — the entire `/query` string is removed from the input and never sent — insert the skill's `/{name}` mention in its place (selection rule above), and return focus to the text area (a mouse selection moves focus to the row, which unmounts when the dropdown closes; keyboard selection never left the text area). Activating Browse SHALL likewise consume the slash text and open the "Use skill" browse modal, but SHALL NOT return focus to the text area: the generic `commandMenu` mechanism's `close({ consumeQuery, returnFocus })` option defaults `returnFocus` to `true` (the selection path above), but Browse SHALL pass `returnFocus: false`. Focusing the text area synchronously reruns the deferred (`requestAnimationFrame`) caret re-evaluation that decides whether the dropdown should be open — by design, the dropdown SHALL always show while the caret sits in a matching `/word` — and since the modal is about to take focus anyway via its own focus trap, refocusing the text area first only reopens the dropdown on top of the modal that is about to steal focus back. The Add-menu "Skills" item SHALL remain available alongside this entry point; selecting a favorite row, activating Browse, or opening View details from the Add menu SHALL likewise consume a `/query`-shaped run touching the caret position the Add menu was opened from — e.g. text left over from a slash-dropdown session the user dismissed with an outside click without reopening it — so that text is never left behind to be sent as an ordinary message.

The consumed `/query` text SHALL be restored to the input if the "Use skill" browse modal is dismissed (X, Escape, or outside click) without a selection — from either entry point (slash dropdown or Add menu). A successful selection SHALL discard the saved text instead, since `insertAndPush` replaces it with the real `/{name}` mention. Restoring the text SHALL re-evaluate the caret's word and reopen the slash dropdown if it is again command-shaped at that position — the same re-evaluation a manual caret move or keystroke would trigger — since a purely programmatic draft change (unlike typing or clicking) does not otherwise reach that evaluation.

The caret is not required to sit outside an already-selected skill's `/{name}` text to open "Use skill": both Browse entry points MAY consume an existing mention's own run exactly as they would a stray unconfirmed query, letting the user replace that skill by picking a different one from the modal. When the consumed run is an already-tracked mention rather than unconfirmed text, canceling SHALL restore it as a mention again — not as inert plain text — via `useSkillMentions`'s `restoreMention` (which re-registers the exact `{url, name}` anchor at the same position, distinct from `insertMention`'s new-selection path since it adds no trailing space and shifts no existing anchors beyond that one insertion). Both Browse call sites detect this by checking whether the consumed run's exact span already matches a tracked anchor before consuming it, since consuming through the normal diff-based `onDraftChange` path drops that anchor as an ordinary edit.

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

#### Scenario: Escape dismissal latches until re-entered

- **WHEN** the user closes the open dropdown with Escape while the message still reads `/my`, then types more characters
- **THEN** the dropdown stays closed
- **AND WHEN** the user deletes the text back to empty and types `/` again
- **THEN** the dropdown reopens

#### Scenario: Outside click reopens without retyping the trigger

- **WHEN** the user closes the open dropdown with an outside click while the message still reads `/my`
- **THEN** the dropdown closes and `/my` stays in the input
- **AND WHEN** the user, without editing the text, refocuses the text area — by clicking back into it, by Tab, or by moving the caret into `/my` with the keyboard
- **THEN** the dropdown reopens, filtered by `my`

#### Scenario: Editing a query the outside click closed keeps it in step

- **WHEN** the dropdown closed on an outside click while the message read `/my`, and the text area is still focused
- **THEN** typing another character, or deleting one, in `/my` reopens the dropdown filtered by the resulting query — with no need to refocus first

#### Scenario: The caret decides which command word is open

- **WHEN** the message holds two command-shaped runs at once, e.g. `/st some text /ready`, and the dropdown is open for `/st`
- **AND** the caret moves — by click or by keyboard (arrow keys, Home/End, Page Up/Down) — into `/ready`
- **THEN** the dropdown SHALL close for `/st` and reopen filtered by `ready`
- **AND WHEN** the caret then moves into the plain text between the two runs
- **THEN** the dropdown closes, with neither run's dropdown open

#### Scenario: Selecting from the dropdown

- **WHEN** the user picks a skill row in the slash dropdown (mouse or keyboard)
- **THEN** the `/query` text is replaced by the skill's `/{name}` mention rendered as `ChatSkill`, the dropdown closes, and focus is in the text area

#### Scenario: Browse does not reopen the dropdown over the modal

- **WHEN** the user activates Browse from the slash dropdown
- **THEN** the `/query` text is removed, the dropdown closes and stays closed, and the "Use skill" browse modal renders with no frame where the dropdown reopens on top of it

#### Scenario: Canceling the browse modal restores the consumed query

- **WHEN** the user activates Browse (consuming `/query`) and then dismisses the modal without picking a skill
- **THEN** `/query` reappears in the input at the same position, and the slash dropdown reopens over it

#### Scenario: Selecting a skill discards the saved query instead of restoring it

- **WHEN** the user activates Browse (consuming `/query`) and then picks a skill from the modal
- **THEN** the input shows the selected skill's `/{name}` mention, not the original `/query` text

#### Scenario: Catalog close immediately after selection preserves the committed mention

- **GIVEN** Browse was opened from either the slash dropdown or the Add menu, consuming an unconfirmed `/query` or an existing tracked skill mention
- **WHEN** the catalog reports a skill selection and then invokes its close callback in the same event, before the input re-renders
- **THEN** the modal SHALL close with the selected skill's `/{name}` mention at the captured insertion position, and the consumed query or previous mention SHALL NOT be restored
- **AND** surrounding text and other tracked mentions SHALL remain intact, the selected skills SHALL follow their order in the draft, and the caret override SHALL remain immediately after the inserted run, including any trailing space added by insertion

#### Scenario: Repeated cancellation restores the consumed run only once

- **GIVEN** Browse was opened from either entry point, consuming an unconfirmed `/query` or an existing tracked skill mention
- **WHEN** the modal is canceled without a selection and its close callback is invoked more than once before the input re-renders
- **THEN** the consumed run SHALL be restored exactly once at its original position, with a previously tracked mention restored as a mention
- **AND** the original draft text and ordered skill references SHALL be preserved without duplicate text or mention anchors

#### Scenario: Canceling Browse over an existing mention restores it as a mention, not plain text

- **WHEN** the caret rests on or inside an already-selected skill's `/{name}` mention, the user activates Browse (from either entry point), and then cancels the modal
- **THEN** the mention reappears unchanged — still rendered as `ChatSkill`, still present in `custom_content.skills`, not inert plain text

#### Scenario: Selecting from Browse over an existing mention replaces it

- **WHEN** the caret rests on an already-selected skill's `/{name}` mention, the user activates Browse, and picks a different skill from the modal
- **THEN** the original mention is replaced by the newly selected skill's `/{name}` mention

#### Scenario: Add-menu selection consumes a stray query left by an outside click

- **WHEN** the text area reads `/qa` because an earlier dropdown session for it was dismissed with an outside click and never reopened, and the user opens the `+` menu and picks a favorite row (or Browse, or View details) under "Skills"
- **THEN** the `/qa` text is removed from the input before the mention is inserted (or the browse/details action is applied), exactly as picking it from the slash dropdown itself would have

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

---

### Requirement: Library boundaries for the skill-selection UI

The host-agnostic skill-selection UI SHALL live in a new `libs/skills` (`@epam/ai-dial-skills`) library — the favorites panel (rows wrapped in the ui-kit `InteractiveTooltip`, plus the optional `searchQuery` filter mode the slash dropdown uses), the shared tooltip content component the rows and `ChatSkill` render (including its unsupported-model message variant), the `ChatSkill` inline component itself with its error state, the `SkillDetailsSidePanel` wrapper composing `@epam/ai-dial-catalog`'s exported `DetailsPanel` (the lib peers on `@epam/ai-dial-catalog`), and the `FavoriteSkillItem` model — together with the state-owning, host-agnostic `useSkillSelectorOverlay` hook, `useSkillMentions`, `SkillCatalogModal`, and the mention-tracking utilities (`diffTextChange`, `findMentionAtCaret`, `insertAnchor`, `reconcileAnchors`, `matchSkillMentions`). The lib's `useSkillSelectorOverlay` owns the modal, mention, and side-panel state and hands `libs/conversation-input` the generic overlay config, the slash `commandMenu` config, and the `activeMentions`/`onBackspaceAtCaret` wiring; it receives the skill listings, favorite ids, viewer bucket, `onToggleFavorite`, labels, `renderCatalogContent`, `detailsPanelComponent`, and `isSkillsSupported` as options. App-owned wiring SHALL stay in `apps/chat`: `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` is a thin wrapper that reads `SkillsContext`, `FavoriteApplicationsContext`, and `UserContext`, builds the translated labels, supplies the lazy `CatalogView` content and `SkillDetailsPanelContainer`, takes `isSkillsSupported` from its caller, and adds `selectSkillByUrl` for the catalog's "Use in chat". Neither library SHALL read the feature flag or the deployment-support signal itself, import app contexts, i18n, routing, or server-api modules, or import deployment types; all strings arrive as props with English defaults, description data arrives from the host-supplied listing entries, and the support value arrives as a plain boolean resolved by the app.

#### Scenario: Libs contain no app knowledge

- **WHEN** `libs/skills` and `libs/conversation-input` are linted and type-checked
- **THEN** no source file imports app contexts, `useTranslation`, routing, server-api modules, feature-flag machinery, or deployment DTO types

#### Scenario: Labels are prop-supplied with English defaults

- **WHEN** `FavoriteSkillsPanel` renders without a labels prop
- **THEN** its strings fall back to English defaults, and a host-supplied labels prop overrides every one of them

### Requirement: RTL support

All new skill-selection UI SHALL use logical Tailwind classes (`ms-*`/`me-*`/`ps-*`/`pe-*`/`text-start`/`text-end`/`start-*`/`end-*`) and CSS logical properties in stylesheets. `IconBlocks`, the star, `IconEye`, and the close icon are symmetric/conceptual and SHALL NOT be mirrored. The interactive tooltip's placement SHALL flip with direction (its end-side anchor and the side panel's end anchoring use logical positioning, so RTL mirrors them automatically).

#### Scenario: RTL layout

- **WHEN** the document direction is RTL
- **THEN** the Skills panel, its interactive tooltip, the browse modal, and the details side panel flip to follow the writing direction

---

### Requirement: Accessibility

- The favorite star button SHALL use `aria-pressed` reflecting favorite state.
- Decorative icons (`IconBlocks`, the skill icon glyph, the filled star glyph, the `IconEye` inside the tooltip's "View details" button) inside already-labeled controls SHALL be `aria-hidden`.
- The tooltip's "View details" button SHALL take its accessible name from its visible label (`skillSelector.viewDetailsLabel`); the row's accessible name SHALL come from the skill name alone, never from tooltip content. The `ChatSkill` chip's accessible name SHALL be its `/{name}` text (`aria-label`).
- The `ChatSkill` chip SHALL be reachable via Tab (`tabIndex={0}`) and announced by its `/{name}` label. While the input has active mentions, the textarea itself is `aria-hidden` so the raw `/{name}` text is not announced a second time next to the chip. Removal SHALL be the whole-mention Backspace gesture in the text area (caret collapsed at the end of the mention's run) — keyboard-operable by construction, needing no separate control or accessible name of its own.
- The slash dropdown's menu region SHALL carry an accessible name (the host-supplied "Skills" label), its rows SHALL be keyboard-reachable, and the "No matching skills" state SHALL be announced through an `aria-live` status region.
- The slash dropdown SHALL behave as a list autocomplete driven from the text area (issue #8992). Its list SHALL be a `role="listbox"` named by the "My Collection" header and each row a `role="option"`; the text area keeps its `textbox` role and carries `aria-autocomplete="list"`, `aria-controls` (the listbox, while open), and `aria-activedescendant` (the active row). With the dropdown open, ArrowDown/ArrowUp SHALL move the active row through the listed skills, wrapping at both ends and starting from the first/last row, instead of navigating message history; the active row SHALL carry `aria-selected="true"` and the row highlight, and SHALL reset whenever the query changes. Enter SHALL take the active row exactly as a click does (consume the `/query`, select the skill, return focus to the text area); with no row active, the send gesture SHALL do nothing — the `/query` never reaches the model while the dropdown is open. Escape SHALL keep closing without sending. Tab SHALL move between rows: a row's star and its tooltip's "View details" stay clickable but leave the Tab sequence (both stay keyboard-reachable from the Add-menu panel, whose rows are unchanged).

#### Scenario: Keyboard selection from the slash dropdown

- **WHEN** the dropdown is open over `/a`, the user presses ArrowDown and then Enter
- **THEN** the `/a` text is replaced by the first listed skill's `/{name}` mention rendered as the chip, focus stays in the text area, and no message is sent

#### Scenario: Enter with no active row

- **WHEN** the dropdown is open over `/a` with no row active and the user presses Enter
- **THEN** nothing is sent, no skill is selected, and the text and the dropdown stay as they were

#### Scenario: Keyboard removal of a mention

- **WHEN** the focus is in the text area with the caret collapsed at the end of a mention's `/{name}` run and the user presses Backspace
- **THEN** the whole mention is removed from the input and the rest of the message text is unchanged

---

### Requirement: i18n keys

The following app i18n keys SHALL exist under the `skillSelector` namespace in `apps/chat/src/i18n/locales/en.json` and the `SkillSelectorI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`: `addMenuLabel` ("Skills"), `emptyHint` ("Star a skill to pin it here"), `modalTitle` ("Use skill"), `viewDetailsLabel` ("View details" — verified absent from `en.json`, so a feature-scoped key is correct), `noMatchingSkillsLabel` ("No matching skills" — slash-dropdown filtered-out state), `emptyQueryHint` ("Type to filter" — the slash dropdown's empty-query hint rendered in the text area), and `unsupportedTooltipLabel` (the `ChatSkill` error-state tooltip message, stating that the selected model does not support skills and that the user should remove the skill or select a different model to proceed — a feature-specific sentence, verified absent from `en.json`), `unavailableTooltipLabel` ("Selected model does not support skills. Select a different model to use a skill."), `deletedTooltipLabel` (the `ChatSkill` tooltip for `SkillUnresolvedReason.Deleted`), `notSharedTooltipLabel` (the `ChatSkill` tooltip for `SkillUnresolvedReason.NotShared`), and `removeSkillLabel` ("Remove skill"). The chat overlay wrapper passes `deletedTooltipLabel`, `notSharedTooltipLabel`, and `unsupportedTooltipLabel` through `SkillSelectorOverlayLabels`; `useSkillSelectorOverlay` forwards `unsupportedTooltipLabel` to the active-mention `ChatSkill` chips in the composer, so the unsupported-model tooltip is translated there too. `removeSkillLabel`, `unavailableTooltipLabel`, and `unsupportedTooltipLabel` are passed by the scheduled-task `SkillSelectorField` host (`ScheduledTaskSkillField`), and `unsupportedTooltipLabel` also by the scheduled-task pages and validation. Shared-value strings ("My Collection", "Browse", "Back", "Remove from favorites") SHALL reuse the existing keys that already carry those values rather than gaining same-value `skillSelector.*` copies, per the duplicate-translation-value rule. The chat input's `ChatSkill` carries no remove control (removal is the input's Backspace gesture, which has no visible text); `removeSkillLabel` serves the controlled `SkillSelectorField`'s clear control.

#### Scenario: Labels use i18n values

- **WHEN** the Skills menu renders in a locale that has translated `skillSelector.addMenuLabel`
- **THEN** the menu item displays the translated label

#### Scenario: The unsupported tooltip is translated

- **WHEN** the `ChatSkill` error-state tooltip renders in a locale that has translated `skillSelector.unsupportedTooltipLabel`
- **THEN** the tooltip displays the translated message

### Requirement: No new backend endpoints

The capability SHALL NOT introduce new backend endpoints, generated-client methods, or caches. Skill listing, details (manifest + file listing), and favorites flow through the existing skills and user-config endpoints the catalog already consumes. The change adds only optional fields to existing response DTOs through the existing OpenAPI regeneration flow: `SkillMetadataItemDto.description` (see the `skills-bff-api` delta) and the deployments `features.skillsSupported` fields (see the `deployments-api` and `deployment-details-api` deltas) — no new route, controller, or client method.

#### Scenario: No API surface changes beyond additive fields

- **WHEN** the change is complete
- **THEN** the generated OpenAPI client and the chat-api controllers expose no new endpoints or operations, and the only response-shape differences are the additive optional fields

### Requirement: Description comes from the listing

A skill's description SHALL come from the already-loaded skill listing (`SkillMetadataItemDto.description`, populated by the BFF from DIAL Core's item-metadata `attributes` — see the `skills-bff-api` capability). The favorites panel rows, their interactive tooltips, and the `ChatSkill` chip SHALL render the listing's `description` directly; a skill whose listing entry carries no `description` renders no description paragraph (the tooltip shows the "View details" button alone). No per-skill `SKILL.md` download, manifest parse, description cache, in-flight tracking, or first-open callback SHALL exist anywhere in the skill-selection UI — opening a tooltip triggers zero requests.

#### Scenario: Tooltip shows the listing description with no request

- **WHEN** the pointer rests on a favorite row whose listing entry carries `description`
- **THEN** the tooltip opens showing that description above the "View details" button
- **AND** no network request is issued for the skill's manifest or files

#### Scenario: Skill without a listing description

- **WHEN** a skill's listing entry has no `description`
- **THEN** the tooltip shows the "View details" button alone, with no error and no fetch

### Requirement: Skill entry points require a deployment that supports skills

The skill-selection entry points SHALL render only when the conversation input's current deployment supports skills — `features.skillsSupported === true` on the listing-based `DeploymentItemDto` for the deployment the input will send to (an absent or `false`/`undefined` flag means not supported, matching DIAL Core's own `false` default). When the deployment does not support skills, the Add-menu "Skills" item, the slash `/` command dropdown, and the "Use skill" browse modal (reachable only through those two) SHALL NOT render on any input surface. The already-selected skill chip, its removal gesture, and the "View details" side panel SHALL remain available when a skill is already selected.

Each input surface resolves its own current deployment: the ongoing-conversation input and the new-conversation composer on the chat route use the selected deployment from `DeploymentsContext`/the composer's `selectedDeployment` prop; the AppsEditor preview chat uses the app deployment itself (its model is fixed to the app). The support value is host-computed and passed into the skill-selection wiring as a plain boolean — `libs/skills` imports no deployment types.

The Catalog page's "Use in chat" on a Skill is NOT an input-surface entry point and is not gated by this requirement (see the `catalog-use-in-chat` capability).

#### Scenario: Add menu hides the Skills item on a non-supporting model

- **WHEN** the selected deployment's `features.skillsSupported` is not `true` and the user opens the Add menu
- **THEN** no "Skills" item renders, on either desktop dropdown or mobile bottom sheet

#### Scenario: Slash dropdown does not open on a non-supporting model

- **WHEN** the selected deployment's `features.skillsSupported` is not `true` and the user types `/` in an empty input
- **THEN** no command dropdown opens (typing or pasting a slash command shape opens nothing)

#### Scenario: Entry points return when a supporting model is selected

- **WHEN** the user switches the selected deployment from a non-supporting model to one with `features.skillsSupported: true`
- **THEN** the Add-menu "Skills" item and the slash dropdown become available again without remounting the input

#### Scenario: Preview chat gates on the app deployment

- **WHEN** the AppsEditor preview chat's app deployment has `features.skillsSupported` not `true`
- **THEN** the preview composer offers no skill entry points, exactly as when the feature flag is disabled

#### Scenario: An already-selected skill stays reachable

- **WHEN** a skill is selected and the user switches to a deployment that does not support skills
- **THEN** each mention's `ChatSkill` chip remains rendered in the input (in the error state below) and the whole-mention Backspace gesture still removes it, even though the Add-menu item and slash dropdown are hidden

### Requirement: Unsupported selected skill renders in the error state and disables sending

While a skill is selected and the input's current deployment does not support skills (`features.skillsSupported` not `true` — whether the skill arrived via the catalog's "Use in chat" or the deployment was switched after selection), the `ChatSkill` chip SHALL render in an error state: the whole visible `/{name}` label carries the error text color (in addition to its typography class), so the entire chip reads as an error. The chip's tooltip SHALL show, in place of the description and "View details" content, a message stating that the selected model does not support skills and that the user should remove the skill or select a different model to proceed. The error state SHALL clear itself — chip color, tooltip content, and sendability all returning to normal — when the user switches back to a deployment that supports skills.

Sending SHALL be disabled while this state holds: the send button SHALL remain mounted (the mention's `/{name}` text keeps the draft non-empty) but disabled, and the configured send gesture SHALL NOT send. Hosts implement this through the input's existing `isSendDisabled` prop, folded together with their existing send-disabled conditions; `libs/conversation-input` gains no skill knowledge.

#### Scenario: Use in chat on an unsupported model shows the error chip

- **WHEN** the chat route's selected deployment does not support skills and a skill is attached (e.g. via the catalog's "Use in chat")
- **THEN** the `ChatSkill` chip renders with its label in the error color
- **AND** hovering or focusing the chip opens the tooltip showing the unsupported-model message instead of the description

#### Scenario: Switching to an unsupported model after selection

- **WHEN** a skill is selected with a supporting model and the user switches the deployment to one that does not support skills
- **THEN** the chip's label switches to the error color and its tooltip content becomes the unsupported-model message

#### Scenario: Switching back restores the normal chip

- **WHEN** the chip is in the error state and the user switches to a deployment with `features.skillsSupported: true`
- **THEN** the chip renders in its normal accent-active styling with the description tooltip, and sending (with an empty draft) is enabled again

#### Scenario: Send is disabled while the skill is unsupported

- **WHEN** the chip is in the error state and the draft is empty
- **THEN** the send button is mounted but disabled, and Enter (or the configured send gesture) does not send

#### Scenario: Removing the skill restores sendability

- **WHEN** the chip is in the error state and the user removes the mention with the whole-mention Backspace gesture
- **THEN** the chip disappears and sending follows the ordinary sendable-content rules for the remaining draft

Selection SHALL be determined by the stored skill reference, not a successful catalog lookup. The overlay SHALL consume the shared pure capability predicate under its existing enabled-flow gate. An unresolved selected reference SHALL retain a fallback chip, unsupported state, and removal gesture.

#### Scenario: Unresolved selected reference blocks unsupported sending

- **WHEN** the enabled chat flow has a selected URL absent from every catalog pool and deployment support is not true
- **THEN** the fallback chip displays the same unsupported message and sending remains disabled until removal or a supporting deployment is selected

### Requirement: Controlled skill field is reusable outside chat inputs

`@epam/ai-dial-skills` SHALL export the array-only `SkillSelectorField` and its props with controlled `value: string[]`, `onChange(value: string[])`, optional resolved `displayNames`, host-supplied `skills`, `isSkillsSupported`, disabled/error state, and injected labels. It SHALL render the UI kit's multiple `Select` with searchable checkbox options and built-in removable tags, and SHALL NOT expose a parallel single-value component or custom picker implementation. It SHALL own only Select open/search state and never import application providers or construct network requests. Saved references missing from the supplied skills SHALL remain visible through their resolved display name or raw URL fallback.

The Select SHALL own its visible label and error rendering. Until the UI kit exposes the combobox's ARIA attributes directly, the wrapper SHALL bridge the effective description and invalid state onto the rendered combobox. An unsupported empty field SHALL be disabled and expose the reason as its caption; when saved references exist, opening and adding SHALL remain disabled while tag removal remains available. Full submission disablement SHALL make all descendant actions inert.

`@epam/ai-dial-chat-shared` SHALL export a pure `isSkillSelectionUnsupported(skillUrl, isSkillsSupported)` predicate; the controlled field, chat overlay hook, and scheduler validator SHALL use it. The predicate SHALL depend on reference presence and strict support, not resolved metadata or feature flags. The chat hook SHALL apply its existing enabled-flow gate around the result. Existing chat-overlay API signatures SHALL remain compatible.

#### Scenario: Controlled external hydration

- **WHEN** a host replaces the selected array while one or more references are absent from the supplied skills
- **THEN** every selected value follows the new prop immediately and remains visible through its display-name or URL fallback

#### Scenario: Choose from the full skill list

- **WHEN** the supported field is activated
- **THEN** the UI-kit multiple Select opens a searchable checkbox list containing every host-supplied skill, without favorites filtering or a Browse catalog action
- **AND** search matches use the shared `Highlight` component and the UI kit announces empty results

#### Scenario: Clear without opening the picker

- **WHEN** a selected tag's remove action is activated
- **THEN** `onChange` receives the remaining ordered references without opening the Select

#### Scenario: Mobile picker presentation

- **WHEN** the field is rendered on mobile or tablet
- **THEN** the responsive UI-kit Select popover remains within the viewport and exposes the same keyboard selection and removal behavior

#### Scenario: Unsupported reference remains removable

- **WHEN** one or more selected references have no supplied option and support is false
- **THEN** the field reports the unsupported state, displays every reference, prevents opening or adding, and still supports removal unless the entire field is disabled

#### Scenario: Keyboard and search behavior is retained

- **WHEN** a keyboard user opens and filters the supplied skills
- **THEN** matched text uses the shared `Highlight`, option activation updates the full array once, and tag removal updates it with only that reference removed
