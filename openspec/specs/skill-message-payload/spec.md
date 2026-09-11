# Spec: skill-message-payload

## Purpose

How a selected skill travels with a user message: the custom_content.skills payload on send, its persistence with the conversation, forwarding on regenerate and continue, restoration on edit, and its rendering and metadata resolution in conversation history.

## Requirements

### Requirement: User message carries the selected skill

`MessageCustomContent` (`libs/chat-shared/src/models/chat.ts`) SHALL gain an optional `skills?: RequestSkill[]` field, where `RequestSkill` is `{ url: string }` — each entry's `url` is the skill's resource path in the same URL form the skill listing and `CatalogItem.id` use (`skills/{bucket}/{path}`). The entry shape SHALL match DIAL Core's merged `RequestSkill` schema (Core PR #1956, 2026-09-11): Core requires each entry to be an object with a non-blank `url` (a bare string is rejected with 400), skips public skills, and auto-shares each referenced non-public skill to the per-request API key with read-only access (the attachment mechanism); a referenced skill the user cannot read fails the request with 403. Sending a user message while a skill is selected SHALL attach a single entry — `{ url: <selected skill's resource path> }` — to that message's `custom_content.skills` (the array shape future-proofs the wire contract) and SHALL clear the selection afterwards, so the next message starts without a skill (per-message semantics, matching how attachments behave). Sending with no skill selected SHALL NOT add the field. The field SHALL flow through the existing message `custom_content` channel — no new endpoint, request shape, or generated-client change is introduced. All skill-usage UI and payload construction SHALL render/execute only when the `features.skillUsageEnabled` flag is enabled for the session.

#### Scenario: Sending with a selected skill

- **WHEN** the user sends a message while a skill is selected
- **THEN** the constructed user message carries `custom_content.skills` with one `{ url }` entry for that skill's resource path, and the input's selection is cleared

#### Scenario: Sending without a skill

- **WHEN** the user sends a message with no skill selected
- **THEN** the user message carries no `skills` entry in its `custom_content`

#### Scenario: First message of an AppsEditor preview conversation

- **WHEN** the user selects a skill in the AppsEditor preview chat's composer and sends the first message
- **THEN** the conversation-creation request carries `custom_content.skills` with the selected skill's `{ url }`, the created conversation's first user message persists it, the continue-last-user completion forwards it unchanged, and the selection is cleared

#### Scenario: No API surface changes

- **WHEN** the change is complete
- **THEN** the generated OpenAPI client, the chat-api controllers, and the completion-request construction are unchanged except for the additive `custom_content.skills` field riding the existing channel

---

### Requirement: Payload persists with the conversation

A user message carrying `custom_content.skills` SHALL persist with the conversation through the existing conversation save/update endpoints verbatim — no stripping, transformation, or re-resolution of the field at save time. Reloading the conversation from the backend SHALL return the field as saved.

#### Scenario: Reload round-trip

- **WHEN** a conversation containing a `custom_content.skills`-carrying user message is saved, then reloaded
- **THEN** the reloaded message carries the same `skills` entries verbatim

---

### Requirement: Regenerate and continue forward the payload unchanged

Regenerating an assistant response and resuming a generation after a reload (the continue-last-user flows) SHALL forward the originating user message's `custom_content` — including `skills` — unchanged to the completion request. No flow SHALL strip or reconstruct the skills field. Forwarding SHALL remain verbatim even when the current viewer lacks read access to a referenced private skill (e.g. someone else's shared conversation): per Core PR #1956 such a request fails server-side with 403 and SHALL surface as an ordinary stream error — the UI SHALL NOT pre-validate or strip the field.

#### Scenario: Regenerate

- **WHEN** the user regenerates a response to a user message that carries `custom_content.skills`
- **THEN** the completion request includes that message's `custom_content` with the `skills` field unchanged

#### Scenario: Regenerate without read access to the skill

- **WHEN** a viewer who cannot read a referenced private skill regenerates that message
- **THEN** the request still carries the `skills` field verbatim and the failure surfaces as a stream error (no silent stripping)

#### Scenario: Continue after reload

- **WHEN** a conversation is reloaded while its last user message awaits a reply and the generation resumes
- **THEN** the resumed request includes that message's `custom_content.skills` unchanged

---

### Requirement: Editing a message restores its skill

Entering edit mode on a user message that carries `custom_content.skills` SHALL seed the corresponding skill into the edit input as the selected skill (rendered as the `ChatSkill` element through the same inline mechanism the conversation input uses). Re-sending the edited message SHALL carry the message's current skill state — unchanged if the user left it selected, absent if the user removed it via the input's Backspace-at-start gesture (the `ChatSkill` element carries no remove control of its own), replaced if the user selected a different skill. Cancelling the edit SHALL change nothing.

#### Scenario: Edit restores the skill

- **WHEN** the user starts editing a message that was sent with a skill
- **THEN** the edit input shows that skill as its selected `ChatSkill` element

#### Scenario: Re-send keeps the skill

- **WHEN** the user re-sends an edited message without touching the restored skill
- **THEN** the updated message carries the same `skills` entry

#### Scenario: Re-send without the skill

- **WHEN** the user removes the restored skill with Backspace at the start of the edit input and re-sends the edited message
- **THEN** the updated message carries no `skills` entry

---

### Requirement: Conversation history renders the skill

A message loaded from conversation history — user or assistant — that carries `custom_content.skills` SHALL render one `ChatSkill` element per entry (today at most one) at the inline-start of the message's first text line, inside the message bubble, with the text word-flowing after it on the same line and wrapping to full width below — the same word flow the conversation input's selected-skill chip has. Hovering/focusing the element SHALL show the same interactive tooltip (description with its loading/absent states above the "View details" button), and activating "View details" SHALL open the same skill details side panel the input flow opens (on the chat route). The bubble slot the element renders in SHALL be a generic `beforeContent` ReactNode prop on the user and assistant message bubbles (forwarded by `MessageBubble`) — `libs/conversation-messages` SHALL NOT know about skills; the user bubble renders the slot inline within the text, the assistant bubble overlays it on the first markdown block's first line (which indents past the measured slot width), and the chip's label SHALL use the type-scale step the bubble's body text uses (host-supplied) so its height matches that text line.

#### Scenario: History display

- **WHEN** a conversation containing a message sent with a skill is opened
- **THEN** that message renders a `ChatSkill` element labeled `/{skill name}` at the inline-start of its first text line, with the message text flowing after it on that line and wrapping to full width below

#### Scenario: History tooltip

- **WHEN** the pointer rests on the history `ChatSkill` element
- **THEN** the interactive tooltip opens showing the description (when resolved) and the "View details" button, and "View details" opens the skill details side panel

#### Scenario: Messages without skills

- **WHEN** a message carries no `skills` entry
- **THEN** its rendering is byte-identical to today (no slot content, no layout change)

---

### Requirement: Skill metadata resolved from the carried url

The wire payload carries only each skill's `url`; display metadata SHALL be resolved app-side per url: the skill's name from the loaded skill listing (`skills`, `sharedWithMe`, and `publicSkills` pools, matched on the entry's `url`); when the url is absent from every pool (a skill the viewer cannot access), the fallback display name SHALL be the url's last non-empty segment. The description SHALL come from the existing per-session lazy description fetch (the same `SKILL.md` download-and-parse pipeline and session cache the favorites tooltip uses — history shares the cache, so a skill already resolved this session does not refetch, and opening history tooltips triggers the fetch with the same first-open callback semantics). A failed fetch or unresolvable url SHALL degrade silently: the element renders with its fallback name and a description-less tooltip, with no error notification and no retry this session.

#### Scenario: Skill present in the listing

- **WHEN** a history message's skill url matches an entry in the loaded listing
- **THEN** the element renders that entry's name, and the tooltip resolves the description via the shared lazy fetch

#### Scenario: Skill absent from the listing

- **WHEN** a history message's skill url matches no loaded listing entry
- **THEN** the element renders with the last url segment as its name and a description-less tooltip, with no error surfaced

#### Scenario: Cache reuse

- **WHEN** a skill's description was already resolved this session (e.g. its menu-row tooltip was opened)
- **THEN** the history tooltip renders the cached description without a new fetch

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
