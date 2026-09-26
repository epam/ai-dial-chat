## ADDED Requirements

### Requirement: Controlled skill field is reusable outside chat inputs

`@epam/ai-dial-skills` SHALL export `SkillSelectorField` and its props with controlled `value?: string`, `onChange`, optional resolved `displayName`, `isSkillsSupported`, disabled/invalid state, label/error IDs, injected labels, and `renderCatalogContent(onSelect, onClose)`. It SHALL accept host-resolved `favorites`, optional favorite/details callbacks, and `renderOverlay` for mobile presentation. It SHALL own popup/focus state and the search query only, reuse the existing skills catalog modal, and never import application providers or construct network requests. It SHALL display the saved reference while metadata is unavailable, replace selection rather than append, and provide an explicit accessible remove action. Browse entry points SHALL be disabled when deployment support is not true; an existing selected value SHALL remain removable.

`@epam/ai-dial-chat-shared` SHALL export a pure `isSkillSelectionUnsupported(skillUrl, isSkillsSupported)` predicate; the controlled field, chat overlay hook, and scheduler validator SHALL use it. The predicate SHALL depend on reference presence and strict support, not resolved metadata or feature flags. The chat hook SHALL apply its existing enabled-flow gate around the result. Existing overlay API signatures SHALL remain compatible.

#### Scenario: Controlled external hydration

- **WHEN** a host changes the field value from one saved reference to another while catalog data is unavailable
- **THEN** the displayed selection follows the new prop immediately without waiting for a second selection state to synchronize

#### Scenario: Choose a favorite or browse the catalog

- **WHEN** the supported field is activated
- **THEN** an input styled consistently with the model/agent selector opens searchable host-supplied favorites, an empty-state hint when appropriate, and a Browse action
- **AND** selecting a favorite replaces the controlled reference and closes the panel; Browse opens the existing skill-only catalog
- **AND** search matches use the shared `Highlight` component and no matches are announced as a live status

#### Scenario: Clear without opening the picker

- **WHEN** the trailing clear button is activated
- **THEN** `onChange(undefined)` removes the selection without opening the dropdown or catalog
- **AND** clearing remains available when the model cannot use skills, unless the entire field is disabled

#### Scenario: Mobile picker presentation

- **WHEN** a host supplies `renderOverlay` for a mobile sheet
- **THEN** the same favorites, search, Browse, and selection behavior is rendered in that sheet, with keyboard dismissal and focus return

#### Scenario: Unsupported reference remains removable

- **WHEN** a selected reference has no catalog item and support is false
- **THEN** the field reports unsupported state, displays the reference, disables browsing, and still supports removal

#### Scenario: Keyboard and search behavior is retained

- **WHEN** a user browses and filters catalog skills using the keyboard
- **THEN** the injected catalog retains its shared `Highlight` matched-text rendering and selection semantics, Escape restores focus, and selection invokes `onChange` once with one reference

## MODIFIED Requirements

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

Selection SHALL be determined by the stored skill reference, not a successful catalog lookup. The overlay SHALL consume the shared pure capability predicate under its existing enabled-flow gate. An unresolved selected reference SHALL retain a fallback chip, unsupported state, and removal gesture.

#### Scenario: Unresolved selected reference blocks unsupported sending

- **WHEN** the enabled chat flow has a selected URL absent from every catalog pool and deployment support is not true
- **THEN** the fallback chip displays the same unsupported message and sending remains disabled until removal or a supporting deployment is selected
