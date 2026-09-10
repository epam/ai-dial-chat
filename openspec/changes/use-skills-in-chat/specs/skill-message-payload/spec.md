# Spec Delta: skill-message-payload (new capability)

## ADDED Requirements

### Requirement: User message carries the selected skill's path

`MessageCustomContent` (`libs/chat-shared/src/models/chat.ts`) SHALL gain an optional `skills?: string[]` field whose entries are skill resource paths in the same URL form the skill listing and `CatalogItem.id` use (`skills/{bucket}/{path}`). Sending a user message while a skill is selected SHALL attach the selected skill's path to that message's `custom_content.skills` (an array holding one entry — the UI selects a single skill; the array shape future-proofs the wire contract) and SHALL clear the selection afterwards, so the next message starts without a skill (per-message semantics, matching how attachments behave). Sending with no skill selected SHALL NOT add the field. The field SHALL flow through the existing message `custom_content` channel — no new endpoint, request shape, or generated-client change is introduced. All skill-usage UI and payload construction SHALL render/execute only when the `features.skillUsageEnabled` flag is enabled for the session.

#### Scenario: Sending with a selected skill

- **WHEN** the user sends a message while a skill is selected
- **THEN** the constructed user message carries `custom_content.skills` with that skill's path, and the input's selection is cleared

#### Scenario: Sending without a skill

- **WHEN** the user sends a message with no skill selected
- **THEN** the user message carries no `skills` entry in its `custom_content`

#### Scenario: No API surface changes

- **WHEN** the change is complete
- **THEN** the generated OpenAPI client, the chat-api controllers, and the completion-request construction are unchanged except for the additive `custom_content.skills` field riding the existing channel

---

### Requirement: Payload persists with the conversation

A user message carrying `custom_content.skills` SHALL persist with the conversation through the existing conversation save/update endpoints verbatim — no stripping, transformation, or re-resolution of the field at save time. Reloading the conversation from the backend SHALL return the field as saved.

#### Scenario: Reload round-trip

- **WHEN** a conversation containing a `custom_content.skills`-carrying user message is saved, then reloaded
- **THEN** the reloaded message carries the same `skills` paths

---

### Requirement: Regenerate and continue forward the payload unchanged

Regenerating an assistant response and resuming a generation after a reload (the continue-last-user flows) SHALL forward the originating user message's `custom_content` — including `skills` — unchanged to the completion request. No flow SHALL strip or reconstruct the skills field.

#### Scenario: Regenerate

- **WHEN** the user regenerates a response to a user message that carries `custom_content.skills`
- **THEN** the completion request includes that message's `custom_content` with the `skills` field unchanged

#### Scenario: Continue after reload

- **WHEN** a conversation is reloaded while its last user message awaits a reply and the generation resumes
- **THEN** the resumed request includes that message's `custom_content.skills` unchanged

---

### Requirement: Editing a message restores its skill

Entering edit mode on a user message that carries `custom_content.skills` SHALL seed the corresponding skill into the edit input as the selected skill (rendered as the `ChatSkill` element through the same inline mechanism the conversation input uses). Re-sending the edited message SHALL carry the message's current skill state — unchanged if the user left it selected, absent if the user removed it via the element's ×, replaced if the user selected a different skill. Cancelling the edit SHALL change nothing.

#### Scenario: Edit restores the skill

- **WHEN** the user starts editing a message that was sent with a skill
- **THEN** the edit input shows that skill as its selected `ChatSkill` element

#### Scenario: Re-send keeps the skill

- **WHEN** the user re-sends an edited message without touching the restored skill
- **THEN** the updated message carries the same `skills` path

#### Scenario: Re-send without the skill

- **WHEN** the user removes the restored skill via its × and re-sends the edited message
- **THEN** the updated message carries no `skills` entry

---

### Requirement: Conversation history renders the skill

A user message loaded from conversation history that carries `custom_content.skills` SHALL render one `ChatSkill` element per entry (today at most one) at the inline-start of the message's content, inside the user message bubble, using the same `ChatSkill` component the conversation input uses. Hovering/focusing the element SHALL show the same interactive tooltip (description with its loading/absent states above the "View details" button), and activating "View details" SHALL open the same skill details side panel the input flow opens (on the chat route). The bubble slot the element renders in SHALL be a generic `beforeContent` ReactNode prop on `UserMessageBubble` (forwarded by `MessageBubble`) — `libs/conversation-messages` SHALL NOT know about skills. Assistant messages SHALL NOT render skills.

#### Scenario: History display

- **WHEN** a conversation containing a message sent with a skill is opened
- **THEN** that user message renders a `ChatSkill` element labeled `/{skill name}` at the inline-start of its content

#### Scenario: History tooltip

- **WHEN** the pointer rests on the history `ChatSkill` element
- **THEN** the interactive tooltip opens showing the description (when resolved) and the "View details" button, and "View details" opens the skill details side panel

#### Scenario: Messages without skills

- **WHEN** a user message carries no `skills` entry
- **THEN** its rendering is byte-identical to today (no slot content, no layout change)

---

### Requirement: Skill metadata resolved from the carried path

The wire payload carries only paths; display metadata SHALL be resolved app-side per path: the skill's name from the loaded skill listing (`skills`, `sharedWithMe`, and `publicSkills` pools, matched on URL); when the path is absent from every pool (a skill the viewer cannot access), the fallback display name SHALL be the path's last non-empty segment. The description SHALL come from the existing per-session lazy description fetch (the same `SKILL.md` download-and-parse pipeline and session cache the favorites tooltip uses — history shares the cache, so a skill already resolved this session does not refetch, and opening history tooltips triggers the fetch with the same first-open callback semantics). A failed fetch or unresolvable path SHALL degrade silently: the element renders with its fallback name and a description-less tooltip, with no error notification and no retry this session.

#### Scenario: Skill present in the listing

- **WHEN** a history message's skill path matches an entry in the loaded listing
- **THEN** the element renders that entry's name, and the tooltip resolves the description via the shared lazy fetch

#### Scenario: Skill absent from the listing

- **WHEN** a history message's skill path matches no loaded listing entry
- **THEN** the element renders with the last path segment as its name and a description-less tooltip, with no error surfaced

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
