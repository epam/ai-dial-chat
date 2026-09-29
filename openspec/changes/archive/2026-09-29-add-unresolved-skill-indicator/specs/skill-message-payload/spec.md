# Spec Delta

## MODIFIED Requirements

### Requirement: Skill metadata resolved from the carried url

The wire payload carries only each skill's `url`; display metadata SHALL be resolved app-side per url: the skill's name from the loaded skill listing (`skills`, `sharedWithMe`, and `publicSkills` pools, matched on the entry's `url`); when the url is absent from every pool (a skill the viewer cannot access), the fallback display name SHALL be the url's last non-empty segment. This resolved name is also what history rendering and edit-mode reconstruction use as the expected `/{name}` text when matching a `custom_content.skills` entry against occurrences in the message text (see "Conversation history renders each skill mention inline" and "Editing a message restores its skill mentions"), left-to-right and in `custom_content.skills` array order, consuming each matched occurrence so a later entry never re-matches an already-consumed one. The description SHALL come from the existing per-session lazy description fetch (the same `SKILL.md` download-and-parse pipeline and session cache the favorites tooltip uses — history shares the cache, so a skill already resolved this session does not refetch, and opening history tooltips triggers the fetch with the same first-open callback semantics).

When the url is absent from every pool, the element additionally carries one of two unresolved reasons, computed with no new request from data already available to the viewer — the url's `skills/{bucket}/{path}` bucket segment compared against the viewer's own bucket (the same identity `chat-hooks-skills-state`'s consumers and `SkillEditor` already read to distinguish a personal resource):

- **`deleted`** — the url's bucket equals the viewer's own bucket. The viewer's own skill no longer exists.
- **`not-shared`** — the url's bucket differs from the viewer's own bucket. A personal skill belonging to someone else (typically the conversation's owner) that was never shared with the viewer, or has since been unshared or deleted — these are indistinguishable from the viewer's side without an additional request, and the wording below does not need to distinguish them.

For either unresolved reason, the tooltip SHALL show an icon and a fixed explanatory sentence in place of the description and the "View details" button — there is no metadata to fetch and no panel to open, and this replaces the previous description-less, button-retaining fallback:

- `deleted`: a trash-can icon with the message "This skill has been deleted. Its details are no longer available."
- `not-shared`: a lock icon with the message "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you."

A failed description fetch for a **resolved** skill (the url matched a pool, only its description request failed or is still pending) is unaffected by this requirement and keeps degrading silently as before: description-less tooltip, "View details" button retained, no error notification, no retry this session.

#### Scenario: Skill present in the listing

- **WHEN** a history message's skill url matches an entry in the loaded listing
- **THEN** the element renders that entry's name, and the tooltip resolves the description via the shared lazy fetch, with the "View details" button present

#### Scenario: Skill absent from the listing

- **WHEN** a history message's skill url matches no loaded listing entry
- **THEN** the element renders with the last url segment as its name, and the tooltip shows one of the two unresolved-reason variants (trash-can/`deleted` or lock/`not-shared`, per the bucket comparison below) instead of a description, with no "View details" button and no error surfaced

#### Scenario: Own skill absent from the listing (deleted)

- **WHEN** a history message's skill url matches no loaded listing entry, and the url's bucket segment equals the viewer's own bucket
- **THEN** the tooltip shows a trash-can icon with "This skill has been deleted. Its details are no longer available."

#### Scenario: Foreign personal skill absent from the listing (not shared)

- **WHEN** a history message's skill url matches no loaded listing entry, and the url's bucket segment differs from the viewer's own bucket
- **THEN** the tooltip shows a lock icon with "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you."

#### Scenario: Description fetch fails for a resolved skill

- **WHEN** a history message's skill url matches a loaded listing entry, but the lazy description fetch for it fails or has not settled
- **THEN** the tooltip shows the "View details" button alone (unchanged from before this change) — this is not an unresolved-url case

#### Scenario: Cache reuse

- **WHEN** a skill's description was already resolved this session (e.g. its menu-row tooltip was opened)
- **THEN** the history tooltip renders the cached description without a new fetch

#### Scenario: Matching consumes occurrences left to right

- **WHEN** a message's text contains `/report` twice and `custom_content.skills` lists two different skills both named "report"
- **THEN** the first occurrence of `/report` in reading order is matched to the first array entry and the second occurrence to the second array entry, regardless of which of the two skills happens to be alphabetically or otherwise "first"

#### Scenario: Applies identically to assistant messages

- **WHEN** an assistant message carries a `custom_content.skills` entry whose url is absent from every pool
- **THEN** that entry's element shows the same unresolved tooltip (trash or lock, per the same bucket comparison) as it would on a user message — the unresolved-state logic does not distinguish message author

---

### Requirement: Conversation history renders each skill mention inline

A user message loaded from conversation history that carries `custom_content.skills` SHALL render one `ChatSkill` element per entry, each positioned inline at that mention's actual location within the message's flowing text — reconstructed by matching the ordered `custom_content.skills` urls against `/{name}` occurrences in the text (Decision 4 of `design.md`) — with the surrounding text word-flowing around each element and wrapping to full width. An assistant message that carries `custom_content.skills` (metadata the assistant's own text did not author) SHALL continue to render all of its entries together at the inline-start of the message's first text line, as today, since assistant text has no reliable mention positions to reconstruct against. Hovering/focusing any rendered element SHALL show an interactive tooltip: for a resolved skill this is the description (with its loading/absent states) above the "View details" button, exactly as before, and activating "View details" SHALL open the same skill details side panel the input flow opens (on the chat route); for an unresolved skill (see "Skill metadata resolved from the carried url") the tooltip instead shows the fixed icon-plus-sentence content for that skill's unresolved reason, with no "View details" button. The bubble slot mechanism (`beforeContent` on `MessageBubble`, forwarded from `libs/conversation-messages`) is generalized from a single `ReactNode` to an ordered set of content, still owned entirely by the host (`libs/conversation-messages` SHALL NOT know about skills) — the user bubble renders the ordered content inline within its plain text, the assistant bubble keeps its existing single-slot overlay behavior for its (still single-position) leading group of chips.

#### Scenario: History display with one mention

- **WHEN** a conversation containing a user message sent with one skill mention is opened
- **THEN** that message renders a `ChatSkill` element labeled `/{skill name}` at the mention's position within the flowing text, with the surrounding text wrapping around it

#### Scenario: History display with multiple mentions

- **WHEN** a conversation containing a user message sent with two skill mentions (e.g. `/abc ... /csd ...`) is opened
- **THEN** that message renders two `ChatSkill` elements, each at its respective mention's position in the flowing text, in the same order as the message's `custom_content.skills` array

#### Scenario: History tooltip

- **WHEN** the pointer rests on any history `ChatSkill` element
- **THEN** the interactive tooltip opens — for a resolved skill showing the description (when resolved) and the "View details" button, and "View details" opens the skill details side panel; for an unresolved skill showing the icon and fixed sentence for that skill's unresolved reason, with no "View details" button

#### Scenario: History tooltip for an unresolved skill

- **WHEN** the pointer rests on a history `ChatSkill` element whose url is unresolved
- **THEN** the interactive tooltip opens showing the icon and fixed sentence for that skill's unresolved reason (trash/`deleted` or lock/`not-shared`), and no "View details" button is rendered

#### Scenario: Assistant message with multiple skill entries

- **WHEN** an assistant message carries more than one `custom_content.skills` entry
- **THEN** all of that message's `ChatSkill` elements render together at the inline-start of its first text line, as a group, unchanged from today's single-slot behavior

#### Scenario: Messages without skills

- **WHEN** a message carries no `skills` entry
- **THEN** its rendering is byte-identical to today (no slot content, no layout change)

#### Scenario: A mention the text no longer contains

- **WHEN** a `custom_content.skills` entry's expected `/{name}` text cannot be located in the message's content (e.g. corrupted or hand-edited data)
- **THEN** that entry renders nowhere in the flowing text — it is neither dropped from the underlying data nor shown as a broken or placeholder element

---

### Requirement: Accessibility

- The history `ChatSkill` element SHALL be keyboard-reachable and its tooltip SHALL open on focus, with the "View details" button — when rendered, i.e. for a resolved skill — operable from the keyboard.
- For an unresolved skill, no "View details" button is rendered, so there is no such keyboard target; the tooltip's icon SHALL be `aria-hidden` and its sentence SHALL be reachable by the same focus/tooltip mechanism as a resolved skill's description.
- The history element SHALL NOT offer a remove control (history is immutable display).
- The element's accessible name SHALL be its visible `/{name}` label; decorative icons inside it (including the unresolved-state trash/lock icon) SHALL be `aria-hidden`.
- Dynamic description resolution (loading → resolved) inside an open tooltip SHALL not trap or relocate focus.

#### Scenario: Keyboard access in history

- **WHEN** a keyboard user Tabs to a history `ChatSkill` element whose url is resolved
- **THEN** the tooltip opens, its "View details" button is reachable and activatable from the keyboard, and the skill details side panel opens on activation

#### Scenario: Keyboard access in history to an unresolved skill

- **WHEN** a keyboard user Tabs to a history `ChatSkill` element whose url is unresolved
- **THEN** the tooltip opens showing the icon and sentence for that skill's unresolved reason, and no keyboard-actionable "View details" control is present
