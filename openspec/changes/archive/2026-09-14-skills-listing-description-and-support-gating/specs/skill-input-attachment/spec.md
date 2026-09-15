# skill-input-attachment Delta

## ADDED Requirements

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

In addition to the `features.skillUsageEnabled` flag conditions stated in the individual entry-point requirements, the skill-selection entry points SHALL render only when the conversation input's current deployment supports skills — `features.skillsSupported === true` on the listing-based `DeploymentItemDto` for the deployment the input will send to (an absent or `false`/`undefined` flag means not supported, matching DIAL Core's own `false` default). When the deployment does not support skills, the Add-menu "Skills" item, the slash `/` command dropdown, and the "Use skill" browse modal (reachable only through those two) SHALL NOT render on any input surface. The already-selected skill chip, its removal gesture, and the "View details" side panel SHALL remain available when a skill is already selected.

Each input surface resolves its own current deployment: the ongoing-conversation input and the new-conversation composer on the chat route use the selected deployment from `DeploymentsContext`/the composer's `selectedDeployment` prop; the AppsEditor preview chat uses the app deployment itself (its model is fixed to the app). The support value is host-computed and passed into the skill-selection wiring as a plain boolean — `libs/skills` imports no deployment types.

The Catalog page's "Use in chat" on a Skill is NOT an input-surface entry point and is not gated by this requirement (see the `catalog-use-in-chat` capability).

#### Scenario: Add menu hides the Skills item on a non-supporting model

- **WHEN** `features.skillUsageEnabled` is enabled, the selected deployment's `features.skillsSupported` is not `true`, and the user opens the Add menu
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
- **THEN** the `ChatSkill` chip remains rendered in the input (in the error state below) and the Backspace-at-position-0 gesture still removes it, even though the Add-menu item and slash dropdown are hidden

### Requirement: Unsupported selected skill renders in the error state and disables sending

While a skill is selected and the input's current deployment does not support skills (`features.skillsSupported` not `true` — whether the skill arrived via the catalog's "Use in chat" or the deployment was switched after selection), the `ChatSkill` chip SHALL render in an error state: the whole visible `/{name}` label carries the error text color (in addition to its typography class), so the entire chip reads as an error. The chip's tooltip SHALL show, in place of the description and "View details" content, a message stating that the selected model does not support skills and that the user should remove the skill or select a different model to proceed. The error state SHALL clear itself — chip color, tooltip content, and sendability all returning to normal — when the user switches back to a deployment that supports skills.

Sending SHALL be disabled while this state holds: the send button SHALL remain mounted (the selected skill still counts as sendable content) but disabled, and the configured send gesture SHALL NOT send. Hosts implement this through the input's existing `isSendDisabled` prop, folded together with their existing send-disabled conditions; `libs/conversation-input` gains no skill knowledge.

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

- **WHEN** the chip is in the error state and the user removes the skill with the Backspace-at-position-0 gesture
- **THEN** the chip disappears and sending follows the ordinary sendable-content rules for the remaining draft

## MODIFIED Requirements

### Requirement: Interactive tooltip on favorite-skill rows

Each favorite-skill row in the Skills panel SHALL be wrapped in the ui-kit `InteractiveTooltip` (with `asChild`, so the row itself remains the trigger). The panel SHALL open on row hover or keyboard focus, place itself to the row's end side on desktop (kit-default Right placement, flipping with direction), and be reachable by Tab from the row. The open state SHALL be the kit's own uncontrolled behavior — the upgraded ui-kit's hover handling keeps the panel open while the pointer travels between the row and the panel, so no panel-managed open state or close timers exist. The app SHALL mount a portal container for these panels at its root (`<div id="interactive-tooltip-portal" />` in `apps/chat/src/main.tsx`): the kit portals every `InteractiveTooltip` panel through floating-ui into `document.getElementById('interactive-tooltip-portal')`, and with no such element in the document the panel silently renders nothing (this container serves every `InteractiveTooltip` in the app, including the prompts panel's migrated rows and the `ChatSkill` chip's tooltip). Its content SHALL be, top to bottom: the skill's description paragraph (the listing's `description` value — see the description-from-listing requirement; the paragraph omitted entirely for a skill whose listing entry carries no description), and below it a link-style "View details" button (ui-kit `Button`, `variant Primary` + `appearance Link`, 24px total height via a `h-[24px]` override of the kit Standard button's 40px — its label class `dial-small-paragraph-semi-text`, 14px/24px semibold, is the design spec, so the kit's `ElementSize.Small` is not used — with `self-start` so it hugs the content's start edge instead of stretching across the panel) with an `IconEye` on its inline-start and its label from `skillSelector.viewDetailsLabel` ("View details"). The panel's max width on desktop SHALL be 550px (via the kit's `contentClassName`, overriding its 320px default). On a touch-only device the tooltip SHALL render nothing — the row still selects the skill on tap, and the row's accessible name SHALL never depend on the tooltip.

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

### Requirement: `ChatSkill` inline component

`libs/skills` SHALL export a `ChatSkill` component that renders a single used skill: a ui-kit `GhostButton` whose visible label is `/` followed by the skill's name (e.g. `/my-skill`), wrapped in the ui-kit `InteractiveTooltip` (`asChild`, uncontrolled open on hover and keyboard focus, top placement by default (design-confirmed) flipping with direction — the favorite rows keep their end-side placement, 550px max panel width on desktop — the same panel the favorite-skill rows use). The component SHALL accept the skill's metadata — `name`, `description` (optional — the listing's value, rendered directly with no fetch), and `path` (the skill's resource URL) — plus an `onViewDetails(path)` callback, an optional `isUnsupported` flag selecting the error state (see the error-state requirement), a `labelClassName` typography override for the `/{name}` label (default `dial-body-paragraph-text`), an `unsupportedLabelClassName` color override applied to the label in the error state (default `text-error`), and label overrides with English defaults (including the unsupported-model tooltip message). The button SHALL carry no remove control of its own — removal is the input's Backspace-at-start gesture (the "Selected skill renders inline inside the input" requirement below); its metrics SHALL be auto height with zero vertical padding and 8px horizontal padding (overriding the kit button's default `h-[40px] px-4` sizing — the kit's `ElementSize.Small` is not used here because it is a fixed 24px with tiny typography, not the chip's 26px line with its 16px label), so the chip's total height is exactly its label line (26px with the default `dial-body-paragraph-text` label). Activating the button body SHALL have no action of its own beyond opening the tooltip. The tooltip's content SHALL be the shared tooltip content component the favorite-skill rows render — in the normal state the description paragraph (omitted when absent) above the "View details" link button with `IconEye`, and in the `isUnsupported` state the unsupported-model message alone (no description paragraph, no "View details" button) — and "View details" SHALL invoke `onViewDetails(path)` and close the tooltip (the kit's tooltip is uncontrolled with no imperative close, so the click remounts it — the fresh instance starts closed; reopening takes a fresh hover or focus). On a touch-only device the tooltip SHALL render nothing and the button remains a non-action element. The same component SHALL be used in the conversation input and in the conversation history (see the `skill-message-payload` delta), so the skill's visual form is identical everywhere; the `isUnsupported` error state applies only to the conversation input's selected-skill chip — history rendering never passes it.

#### Scenario: Button label

- **WHEN** `ChatSkill` renders for a skill named "my-skill"
- **THEN** the button's visible label is `/my-skill`

#### Scenario: Tooltip on hover

- **WHEN** the pointer rests on the `ChatSkill` button and the skill's listing entry carries a description
- **THEN** the interactive tooltip opens above the button showing the description above the "View details" button, and stays open while the pointer moves onto the panel

#### Scenario: Button body has no action

- **WHEN** the user clicks the `ChatSkill` button body
- **THEN** no selection, navigation, or send-time effect occurs — only the tooltip opens

#### Scenario: View details

- **WHEN** the user clicks "View details" in the `ChatSkill` tooltip
- **THEN** the host's `onViewDetails` receives the skill's path and the skill details side panel opens (chat route) or the catalog details open, per the host's wiring
- **AND** the tooltip closes immediately (the click remounts it; reopening takes a fresh hover or focus)

#### Scenario: Unsupported state tooltip

- **WHEN** `ChatSkill` renders with `isUnsupported` and the tooltip opens
- **THEN** the tooltip shows the unsupported-model message alone — no description paragraph and no "View details" button — and the `/{name}` label carries the error color

### Requirement: Selected skill renders inline inside the input

The selected skill SHALL be rendered inside the conversation input's text area, at its inline-start on the first text line — not outside the input and not below the text area — and the user SHALL be able to keep typing in the same input while the skill is selected. Typed text SHALL start after the `ChatSkill` element on the first line and wrapped lines SHALL use the text area's full width (the text flows around the element; lines after an explicit line break also use the full width). While the slot is present the input's placeholder SHALL be suppressed (the slot itself says what the input holds); the text area SHALL gain no extra block padding while the slot is present, so slot content whose height is one label line (the `ChatSkill` chip, which carries no vertical padding of its own) aligns with the first text line exactly. The mechanism SHALL be a generic `inlineStartSlot?: ReactNode` prop on `Input` (forwarded by `ConversationInput` and `EditMessageInput`) whose content the app supplies — `libs/conversation-input` SHALL NOT know about skills; the flow-around mechanics (slot positioning and the first-line indent of the text) SHALL be the lib's own generic behavior driven by the slot's measured width, using logical properties so RTL mirrors automatically. `Input` SHALL also expose `onInlineStartRemove?: () => void`, invoked when Backspace is pressed with the caret collapsed at position 0 while the slot is present — the slot's remove gesture (at position 0 a Backspace has nothing to delete backwards, so the keypress is suppressed and redirected to the slot; no text is affected) — and forwarded by `ConversationInput` and `EditMessageInput`. The slot's presence SHALL count as sendable content on its own: while a skill is selected the send button SHALL be mounted and enabled and the configured send gesture SHALL send even with an empty draft (the send-time payload carrying the skill is the `skill-message-payload` capability's concern), except while the selected skill is unsupported — in that state the send button stays mounted but disabled per the error-state requirement above. Removing the skill with an empty draft SHALL disable sending again. The part-1 `selectedEntities`/`selectedEntityChipLabels` props and the `SelectedEntityChips` component SHALL be removed in the same change (the selected skill was their only consumer); all call sites migrate to the slot.

#### Scenario: Skill inside the input with typed text

- **WHEN** a skill is selected and the user types "summarize this"
- **THEN** the `ChatSkill` element renders at the inline-start of the text area and the typed text begins after it on the same line

#### Scenario: Skill selected with an empty draft

- **WHEN** a skill is selected and the text area is empty
- **THEN** the send button is mounted and enabled, and the configured send gesture (Enter or its meta-key variant) sends the message with the skill in its payload per the `skill-message-payload` capability

#### Scenario: Unsupported skill selected with an empty draft

- **WHEN** a skill is selected, the current deployment does not support skills, and the text area is empty
- **THEN** the send button is mounted but disabled, and the configured send gesture does not send

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

### Requirement: Library boundaries for the skill-selection UI

The host-agnostic skill-selection UI SHALL live in a new `libs/skills` (`@epam/ai-dial-skills`) library — the favorites panel (rows wrapped in the ui-kit `InteractiveTooltip`, plus the optional `searchQuery` filter mode the slash dropdown uses), the shared tooltip content component the rows and `ChatSkill` render (including its unsupported-model message variant), the `ChatSkill` inline component itself with its error state, the `SkillDetailsSidePanel` wrapper composing `@epam/ai-dial-catalog`'s exported `DetailsPanel` (the lib peers on `@epam/ai-dial-catalog`), and the `FavoriteSkillItem` model. App-owned wiring SHALL stay in `apps/chat`: a `useSkillSelectorOverlay` hook (mirroring `usePromptSelectorOverlay`) that reads `SkillsContext`/`FavoriteApplicationsContext`, owns the modal, selection, and side-panel state, resolves whether the current deployment supports skills, and hands `libs/conversation-input` the generic overlay config, the slash `commandMenu` config, and the `ChatSkill` element for the input's `inlineStartSlot`. Neither library SHALL read the feature flag or the deployment-support signal itself, import app contexts, i18n, routing, or server-api modules, or import deployment types; all strings arrive as props with English defaults, description data arrives from the host-supplied listing entries, and the support value arrives as a plain boolean resolved by the app.

#### Scenario: Libs contain no app knowledge

- **WHEN** `libs/skills` and `libs/conversation-input` are linted and type-checked
- **THEN** no source file imports app contexts, `useTranslation`, routing, server-api modules, feature-flag machinery, or deployment DTO types

#### Scenario: Labels are prop-supplied with English defaults

- **WHEN** `FavoriteSkillsPanel` renders without a labels prop
- **THEN** its strings fall back to English defaults, and a host-supplied labels prop overrides every one of them

### Requirement: i18n keys

The following app i18n keys SHALL exist under the `skillSelector` namespace in `apps/chat/src/i18n/locales/en.json` and the `SkillSelectorI18nKeys` enum in `apps/chat/src/constants/translation-keys.ts`: `addMenuLabel` ("Skills"), `emptyHint` ("Star a skill to pin it here"), `modalTitle` ("Use skill"), `viewDetailsLabel` ("View details" — verified absent from `en.json`, so a feature-scoped key is correct), `noMatchingSkillsLabel` ("No matching skills" — slash-dropdown filtered-out state), `emptyQueryHint` ("Type to filter" — the slash dropdown's empty-query hint rendered in the text area), and `unsupportedTooltipLabel` (the `ChatSkill` error-state tooltip message, stating that the selected model does not support skills and that the user should remove the skill or select a different model to proceed — a feature-specific sentence, verified absent from `en.json`). Shared-value strings ("My Collection", "Browse", "Back", "Remove from favorites") SHALL reuse the existing keys that already carry those values rather than gaining same-value `skillSelector.*` copies, per the duplicate-translation-value rule. The `ChatSkill` carries no remove control, so no remove-control label key is needed (removal is the input's Backspace gesture, which has no visible text).

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

## REMOVED Requirements

### Requirement: Lazy description resolution

**Reason**: DIAL Core PR #1970 now returns each skill's `description` in the listing metadata (`attributes` on skill item metadata), so the lazy per-skill `SKILL.md` download — an N+1 request pattern (one download per hovered skill per session) — is obsolete. The archived change recorded this removal as its deferred condition and Follow-up 2 cleanup.

**Migration**: Descriptions now come from the listing (`SkillMetadataItemDto.description`) per the ADDED "Description comes from the listing" requirement. The lazy fetch machinery is deleted, not disabled: `fetchSkillDescription` in `libs/chat-hooks/src/catalog/useSkillItemDetails.ts` (the details-panel manifest fetch stays), the app wrapper's `handleFetchSkillDescription`, the lib hook's `onFetchSkillDescription` parameter, per-session description cache, in-flight/pending state, and first-open callback, `FavoriteSkillItem.isDescriptionLoading`, and the `isDescriptionLoading` spinner branches in `libs/skills` are all removed. `SkillListingEntry` and `FavoriteSkillItem` take `description` directly from the listing entry.
