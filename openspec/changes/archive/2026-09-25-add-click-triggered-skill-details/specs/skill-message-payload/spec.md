## MODIFIED Requirements

### Requirement: Composing renders mentions as highlighted text, not full chips

While a message is being actively composed or edited, each currently-tracked skill mention SHALL render as a highlighted run of the mention's own `/{name}` text, sharing the character width and font of the surrounding draft text exactly. A host that enables the click trigger for active mentions SHALL expose the existing description card only when the user clicks the mention or activates it with Enter or Space; hover and focus alone SHALL NOT open it. The card SHALL retain its existing description states and "View details" action, and only that action SHALL open the skill details side panel. A host that omits the optional trigger setting, including the parent chat application, SHALL retain the existing hover/focus behavior. Selecting a skill from the `/` command menu or the Skills add-menu SHALL insert `/{name}` into the draft text at the caret and begin tracking it as a mention; placing the caret at the trailing boundary of a tracked mention and pressing Backspace SHALL remove that entire mention's text in one operation rather than one character; editing into the interior of a tracked mention's text SHALL stop tracking it as a mention (its text remains as plain text) rather than partially updating it.

#### Scenario: Inserting a mention from the command menu

- **WHEN** the user types `/` at the caret in an empty textarea, the Skills popup opens, and the user selects a skill
- **THEN** `/{name}` is inserted into the draft at that position, rendered as a highlighted run, and tracked as a mention

#### Scenario: Inserting a mention mid-sentence from the add menu

- **WHEN** the user has already typed text, places the caret mid-sentence, opens the Skills add-menu, and selects a skill
- **THEN** `/{name}` is inserted at the caret position (not at the start of the message), rendered as a highlighted run inline with the surrounding typed text, and tracked as a mention

#### Scenario: Whole-mention Backspace

- **WHEN** the caret is collapsed immediately after a tracked mention's text and the user presses Backspace
- **THEN** the entire `/{name}` run is removed in a single edit, and that mention no longer contributes a `custom_content.skills` entry on send

#### Scenario: Editing inside a mention breaks it

- **WHEN** the user places the caret inside a tracked mention's `/{name}` text and types or deletes a character
- **THEN** that run stops being tracked as a mention (no more highlight, no `custom_content.skills` entry on send) while its current text remains in the draft as plain text

#### Scenario: Click opens the active-mention card

- **WHEN** a host configured `activeMentionDetailsTrigger` as `click` and the user clicks a highlighted mention or activates it with Enter or Space
- **THEN** the description card opens without opening the skill details side panel

#### Scenario: Hover does not open the click-triggered card

- **WHEN** the pointer rests on or focus reaches a highlighted mention in a host configured with `activeMentionDetailsTrigger` as `click`
- **THEN** no description card opens until the user explicitly activates the mention

#### Scenario: The card retains the details action

- **WHEN** the click-triggered description card is open and the user activates "View details"
- **THEN** the existing skill details side panel opens for that skill

#### Scenario: Default host behavior remains hover-triggered

- **WHEN** a host omits `activeMentionDetailsTrigger` for a composing mention
- **THEN** hover and keyboard focus open the existing description card
