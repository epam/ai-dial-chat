# Spec: skill-message-payload

## Purpose

How selected skills travel with a user message: the custom_content.skills payload on send, its persistence with the conversation, forwarding on regenerate and continue, restoration on edit, and its rendering and metadata resolution in conversation history.

## Requirements

### Requirement: User message carries the selected skill

`MessageCustomContent` (`libs/chat-shared/src/models/chat.ts`) SHALL retain the optional `skills?: RequestSkill[]` field, where `RequestSkill` is `{ url: string }` — each entry's `url` is the skill's resource path in the same URL form the skill listing and `CatalogItem.id` use (`skills/{bucket}/{path}`), matching DIAL Core's merged `RequestSkill` schema (Core PR #1956, 2026-09-11) unchanged. A message MAY now carry **any number** of skill mentions, not at most one. A skill mention is represented in the message text as the literal substring `/{name}` at the point the user selected it (from the `/` command menu or the Skills add-menu); `custom_content.skills` SHALL list one `{ url }` entry per mention, **in the same left-to-right order the mentions appear in the message text** — order is the only way to disambiguate two mentions whose displayed `/{name}` label is identical but which resolve to different skills (different `url`). Sending a user message with one or more mentions SHALL attach a `custom_content.skills` entry per mention, in that order, and SHALL clear every mention from the composer's draft afterwards, so the next message starts with none (per-message semantics, matching how attachments behave, extended from "the one selection" to "every mention"). Sending with no mentions SHALL NOT add the field. The field SHALL flow through the existing message `custom_content` channel — no new endpoint, request shape, or generated-client change is introduced. All skill-usage UI and payload construction SHALL render/execute only when the `features.skillUsageEnabled` flag is enabled for the session.

#### Scenario: Sending with a single mention

- **WHEN** the user sends a message containing exactly one skill mention
- **THEN** the constructed user message carries `custom_content.skills` with one `{ url }` entry for that skill's resource path, and the mention is cleared from the composer's draft

#### Scenario: Sending with multiple mentions

- **WHEN** the user sends a message such as `/abc please summarize this, then run /csd on the result`, having selected the skill behind `/abc` and then the skill behind `/csd`
- **THEN** the constructed user message's `custom_content.skills` carries two entries, `[{ url: <abc's url> }, { url: <csd's url> }]`, in that order — matching the mentions' left-to-right position in the sent text — and both mentions are cleared from the composer's draft afterwards

#### Scenario: Two mentions with the same displayed name, different skills

- **WHEN** the user's message contains two mentions that both render as `/report` but were selected from two different skills (different resource paths)
- **THEN** `custom_content.skills` carries both entries in the order the mentions appear in the text, and that order — not the shared name — is what a reader (or the app, on reload) uses to tell them apart

#### Scenario: Sending without a skill

- **WHEN** the user sends a message with no skill mentions
- **THEN** the user message carries no `skills` entry in its `custom_content`

#### Scenario: First message of an AppsEditor preview conversation

- **WHEN** the user mentions one or more skills in the AppsEditor preview chat's composer and sends the first message
- **THEN** the conversation-creation request carries `custom_content.skills` with one ordered entry per mention, the created conversation's first user message persists it, the continue-last-user completion forwards it unchanged, and every mention is cleared from the composer's draft afterwards

#### Scenario: No API surface changes

- **WHEN** the change is complete
- **THEN** the generated OpenAPI client, the chat-api controllers, and the completion-request construction are unchanged except for the additive `custom_content.skills` field riding the existing channel, its length no longer capped at one entry, and its per-entry `url` being percent-encoded for the wire (see the regenerate/continue requirement below)

---

### Requirement: Payload persists with the conversation

A user message carrying `custom_content.skills` SHALL persist with the conversation through the existing conversation save/update endpoints verbatim — no stripping, transformation, or re-resolution of the field at save time. Reloading the conversation from the backend SHALL return the field as saved.

#### Scenario: Reload round-trip

- **WHEN** a conversation containing a `custom_content.skills`-carrying user message is saved, then reloaded
- **THEN** the reloaded message carries the same `skills` entries verbatim

---

### Requirement: Regenerate and continue forward the payload unchanged

Regenerating an assistant response and resuming a generation after a reload (the continue-last-user flows) SHALL forward the originating user message's `custom_content` — including `skills` — unchanged to the completion request. No flow SHALL strip or reconstruct the skills field. Forwarding SHALL remain verbatim even when the current viewer lacks read access to a referenced private skill (e.g. someone else's shared conversation): per Core PR #1956 such a request fails server-side with 403 and SHALL surface as an ordinary stream error — the UI SHALL NOT pre-validate or strip the field.

"Unchanged" governs selection and inclusion of the field, not its wire byte-encoding: `chat-api`'s completion-request builder (`ConversationStreamingService`, `apps/chat-api/src/conversations/streaming/conversation-streaming.service.ts`) SHALL percent-encode each forwarded `skills[].url`'s path segments (via the same `encodeDialResourcePath` helper used for every other DIAL resource path this service sends to DIAL Core) immediately before including it in the outbound completion request body. This is encoding, not stripping or re-resolution — the url's segments (decoded first, so an already-encoded url is not double-encoded) are preserved, only reserved characters (e.g. spaces) are escaped. Without it, a skill resource path containing a reserved character is rejected by DIAL Core with 400 for every deployment, even though the same skill is selectable and its metadata resolves normally — persistence (previous requirement) and history rendering (below) continue to use the raw, non-percent-encoded url from `custom_content.skills`; only the value sent to DIAL Core in the completion request is encoded.

#### Scenario: Regenerate

- **WHEN** the user regenerates a response to a user message that carries `custom_content.skills`
- **THEN** the completion request includes that message's `custom_content` with the `skills` field unchanged, its `url` percent-encoded for the wire

#### Scenario: Regenerate without read access to the skill

- **WHEN** a viewer who cannot read a referenced private skill regenerates that message
- **THEN** the request still carries the `skills` field verbatim (percent-encoded) and the failure surfaces as a stream error (no silent stripping)

#### Scenario: Continue after reload

- **WHEN** a conversation is reloaded while its last user message awaits a reply and the generation resumes
- **THEN** the resumed request includes that message's `custom_content.skills` unchanged, its `url` percent-encoded for the wire

#### Scenario: Skill path with reserved characters

- **WHEN** the selected skill's resource path contains a character requiring percent-encoding (e.g. a space, as in `skills/public/my chats/123`)
- **THEN** the completion request sent to DIAL Core carries the percent-encoded `url` (e.g. `skills/public/my%20chats/123`), while the persisted conversation and the rendered `ChatSkill` element continue to use the raw, unencoded path

---

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

---

### Requirement: Editing a message restores its skill mentions

Entering edit mode on a user message that carries `custom_content.skills` SHALL reconstruct each entry's position in the message text (matching the ordered `custom_content.skills` urls against `/{name}` occurrences in the text, resolving each entry's expected name from the current skill listing) and seed the edit input's draft with that same text plus live tracking of each successfully-located mention, so further edits, undo, and Backspace behave the same as during original composition. A mention whose exact `/{name}` text cannot be located (e.g. a prior edit, before this edit session, partially altered it) is not seeded as a live-tracked mention — its literal text (whatever it now reads) is preserved as plain text in the draft. Re-sending the edited message SHALL carry exactly the message's current mention state: unchanged entries the user left alone, entries removed via the whole-mention Backspace gesture or by editing into a mention's text, and entries added by selecting further skills during the edit — each still in the text's left-to-right order.

#### Scenario: Edit restores every mention

- **WHEN** the user starts editing a message that was sent with two skill mentions
- **THEN** the edit input's draft text shows both mentions at their original positions, both live-tracked as mentions

#### Scenario: Re-send keeps all mentions

- **WHEN** the user re-sends an edited message without touching any of its restored mentions
- **THEN** the updated message carries the same ordered `skills` entries as before the edit

#### Scenario: Re-send after removing one of several mentions

- **WHEN** the user removes one restored mention (via the whole-mention Backspace gesture, with the caret collapsed immediately after that mention) and re-sends the edited message, leaving the other mention(s) untouched
- **THEN** the updated message's `skills` array omits the removed mention's entry and keeps the others, in their original relative order

#### Scenario: Re-send without any skill

- **WHEN** the user removes every restored mention and re-sends the edited message
- **THEN** the updated message carries no `skills` entry

#### Scenario: Editing into a mention's text breaks it

- **WHEN** the user places the caret inside a restored mention's `/{name}` text (not at its trailing boundary) and types or deletes a character there
- **THEN** that mention is no longer tracked as a skill mention (its `custom_content.skills` entry is dropped on send), and the edited text remains in the draft as plain text

#### Scenario: Cancelling the edit changes nothing

- **WHEN** the user cancels an edit after the draft's mentions were reconstructed or changed
- **THEN** the original message and its `custom_content.skills` are unchanged

---

### Requirement: Conversation history renders each skill mention inline

A user message loaded from conversation history that carries `custom_content.skills` SHALL render one `ChatSkill` element per entry, each positioned inline at that mention's actual location within the message's flowing text — reconstructed by matching the ordered `custom_content.skills` urls against `/{name}` occurrences in the text (Decision 4 of `design.md`) — with the surrounding text word-flowing around each element and wrapping to full width. An assistant message that carries `custom_content.skills` (metadata the assistant's own text did not author) SHALL continue to render all of its entries together at the inline-start of the message's first text line, as today, since assistant text has no reliable mention positions to reconstruct against. Hovering/focusing any rendered element SHALL show the same interactive tooltip (description with its loading/absent states above the "View details" button) as before, and activating "View details" SHALL open the same skill details side panel the input flow opens (on the chat route). The bubble slot mechanism (`beforeContent` on `MessageBubble`, forwarded from `libs/conversation-messages`) is generalized from a single `ReactNode` to an ordered set of content, still owned entirely by the host (`libs/conversation-messages` SHALL NOT know about skills) — the user bubble renders the ordered content inline within its plain text, the assistant bubble keeps its existing single-slot overlay behavior for its (still single-position) leading group of chips.

#### Scenario: History display with one mention

- **WHEN** a conversation containing a user message sent with one skill mention is opened
- **THEN** that message renders a `ChatSkill` element labeled `/{skill name}` at the mention's position within the flowing text, with the surrounding text wrapping around it

#### Scenario: History display with multiple mentions

- **WHEN** a conversation containing a user message sent with two skill mentions (e.g. `/abc ... /csd ...`) is opened
- **THEN** that message renders two `ChatSkill` elements, each at its respective mention's position in the flowing text, in the same order as the message's `custom_content.skills` array

#### Scenario: History tooltip

- **WHEN** the pointer rests on any history `ChatSkill` element
- **THEN** the interactive tooltip opens showing the description (when resolved) and the "View details" button, and "View details" opens the skill details side panel

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

### Requirement: Skill metadata resolved from the carried url

The wire payload carries only each skill's `url`; display metadata SHALL be resolved app-side per url: the skill's name from the loaded skill listing (`skills`, `sharedWithMe`, and `publicSkills` pools, matched on the entry's `url`); when the url is absent from every pool (a skill the viewer cannot access), the fallback display name SHALL be the url's last non-empty segment. This resolved name is also what history rendering and edit-mode reconstruction use as the expected `/{name}` text when matching a `custom_content.skills` entry against occurrences in the message text (see "Conversation history renders each skill mention inline" and "Editing a message restores its skill mentions"), left-to-right and in `custom_content.skills` array order, consuming each matched occurrence so a later entry never re-matches an already-consumed one. The description SHALL come from the existing per-session lazy description fetch (the same `SKILL.md` download-and-parse pipeline and session cache the favorites tooltip uses — history shares the cache, so a skill already resolved this session does not refetch, and opening history tooltips triggers the fetch with the same first-open callback semantics). A failed fetch or unresolvable url SHALL degrade silently: the element renders with its fallback name and a description-less tooltip, with no error notification and no retry this session.

#### Scenario: Skill present in the listing

- **WHEN** a history message's skill url matches an entry in the loaded listing
- **THEN** the element renders that entry's name, and the tooltip resolves the description via the shared lazy fetch

#### Scenario: Skill absent from the listing

- **WHEN** a history message's skill url matches no loaded listing entry
- **THEN** the element renders with the last url segment as its name and a description-less tooltip, with no error surfaced

#### Scenario: Cache reuse

- **WHEN** a skill's description was already resolved this session (e.g. its menu-row tooltip was opened)
- **THEN** the history tooltip renders the cached description without a new fetch

#### Scenario: Matching consumes occurrences left to right

- **WHEN** a message's text contains `/report` twice and `custom_content.skills` lists two different skills both named "report"
- **THEN** the first occurrence of `/report` in reading order is matched to the first array entry and the second occurrence to the second array entry, regardless of which of the two skills happens to be alphabetically or otherwise "first"

---

### Requirement: Command-menu popup opens on the word at the caret, anywhere in the textarea

The slash-command popup SHALL open whenever the whitespace-delimited word containing the caret starts with the trigger character (e.g. `/`) and contains no whitespace or second trigger character — regardless of where that word sits in the textarea (start, middle, after other text, between two existing words, or as the only content) and regardless of what other text the message already contains. The popup SHALL stay open while that same word keeps matching, and SHALL close the moment the caret's word stops matching (including when the caret moves to a different, non-matching word). It SHALL reopen when that word's value becomes exactly the bare trigger character again after having been dismissed (Escape or an outside click) while more characters followed the trigger within the same word — for example: typing `/sdf`, dismissing the popup, then backspacing `/sdf` → `/sd` → `/s` → `/`. The popup SHALL NOT reopen at any intermediate value with characters still following the trigger within that word (e.g. it does not reopen at `/sd` or `/s` during that same backspacing sequence), and SHALL NOT reopen merely because the word still matches the trigger-plus-query shape without actually returning to the bare trigger.

#### Scenario: Opens on a trigger typed after other text

- **WHEN** the user has already typed `text text ` and types `/` next
- **THEN** the popup opens, exactly as it would if the textarea had been empty

#### Scenario: Opens on a trigger typed between two existing words

- **WHEN** the user places the caret between two words separated by whitespace and types `/`
- **THEN** the popup opens, scoped to that new word, without affecting the surrounding text

#### Scenario: Reopens after backspacing a mid-message trigger word back to bare

- **WHEN** the user types `/ab ` after other text, dismisses the resulting popup, then backspaces the word down to `/` (e.g. `/ab` → `/a` → `/`)
- **THEN** the popup reopens the moment that word's value becomes exactly `/`, the same as it does when the same word sits at the start of an otherwise-empty textarea

#### Scenario: Reopens on backspacing to the bare trigger after dismissal

- **WHEN** the user types `/sdf`, dismisses the resulting popup without selecting anything, then presses Backspace three times until the textarea reads `/`
- **THEN** the popup reopens the moment the textarea's value becomes exactly `/`

#### Scenario: Does not reopen while a query still follows the trigger

- **WHEN** the user types `/sdf`, dismisses the popup, then backspaces once to `/sd`
- **THEN** the popup does not reopen while the value is `/sd`

#### Scenario: Unaffected — clearing to empty and retyping still reopens

- **WHEN** the user dismisses the popup, clears the textarea entirely, and types the trigger character again
- **THEN** the popup reopens, as it already does today

---

### Requirement: RTL support

All payload-driven UI SHALL use logical Tailwind classes and CSS logical properties. The `ChatSkill` element, its tooltip, and the history bubble slot SHALL mirror automatically under `dir="rtl"` (end-side tooltip placement, inline-start anchoring). The `/` label prefix is part of the skill's textual name and SHALL NOT be mirrored.

#### Scenario: RTL history

- **WHEN** the document direction is RTL and a message with a skill is displayed
- **THEN** the `ChatSkill` element anchors to the inline-start (right) edge of the message content and the tooltip opens on the mirrored side

---

### Requirement: Accessibility

- The history `ChatSkill` element SHALL be keyboard-reachable and its tooltip SHALL open on focus, with the "View details" button operable from the keyboard.
- The history element SHALL NOT offer a remove control (history is immutable display).
- The element's accessible name SHALL be its visible `/{name}` label; decorative icons inside it SHALL be `aria-hidden`.
- Dynamic description resolution (loading → resolved) inside an open tooltip SHALL not trap or relocate focus.

#### Scenario: Keyboard access in history

- **WHEN** a keyboard user Tabs to a history `ChatSkill` element
- **THEN** the tooltip opens, its "View details" button is reachable and activatable from the keyboard, and the skill details side panel opens on activation
