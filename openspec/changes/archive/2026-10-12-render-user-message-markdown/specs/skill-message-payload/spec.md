## MODIFIED Requirements

### Requirement: Conversation history renders each skill mention inline

A user message loaded from conversation history that carries `custom_content.skills` SHALL render one `ChatSkill` element per entry, each positioned inline at that mention's actual location within the message's Markdown-rendered text. The position is reconstructed by matching the ordered `custom_content.skills` urls against `/{name}` occurrences in the text (Decision 4 of `design.md`). The surrounding text SHALL word-flow around each element and wrap to full width.

A mention that falls inside an inline code span, a fenced or indented code block, or a link's text SHALL instead render as its literal `/{name}` text at that position, so code stays plain text and no interactive chip nests inside a link. The Markdown syntax around a mention SHALL NOT alter the mention itself. For example, underscores in `/my_skill_name` are never parsed as emphasis.

An assistant message that carries `custom_content.skills` (metadata the assistant's own text did not author) SHALL continue to render all of its entries together at the inline-start of the message's first text line, as today, since assistant text has no reliable mention positions to reconstruct against.

Hovering or focusing any rendered element SHALL show an interactive tooltip:

- For a resolved skill, the tooltip shows the listing's description (omitted when absent) above the "View details" button, exactly as before. Activating "View details" SHALL open the same skill details side panel the input flow opens (on the chat route).
- For an unresolved skill (see "Skill metadata resolved from the carried url"), the tooltip instead shows the fixed icon-plus-sentence content for that skill's unresolved reason, with no "View details" button.

Each history element SHALL be the same `ChatSkill` markup the composer renders: the inline `<span class="dial-skills-chip">` with `aria-label` `/{name}`. A skill therefore reads identically in the draft and in history.

The `MessageBubble` slots (from `libs/conversation-messages`) stay host-owned, and `libs/conversation-messages` SHALL NOT know about skills. The user bubble takes `textSegments`, an ordered array that interleaves plain-text runs (strings) with inline segments, each carrying its rendered `node` and its literal source `text`. It renders each inline segment's `node` at its position within the Markdown output, or the segment's `text` inside code or link text. `renderHistorySkillSegments` (`libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx`) SHALL produce that shape, with `text` set to the matched `/{name}` substring of the content. The assistant bubble keeps its single `beforeContent` slot overlay for its leading group of chips.

#### Scenario: History display with one mention

- **WHEN** a conversation containing a user message sent with one skill mention is opened
- **THEN** that message renders a `ChatSkill` element labeled `/{skill name}` at the mention's position within the flowing text, with the surrounding text wrapping around it

#### Scenario: History display with multiple mentions

- **WHEN** a conversation containing a user message sent with two skill mentions (e.g. `/abc ... /csd ...`) is opened
- **THEN** that message renders two `ChatSkill` elements, each at its respective mention's position in the flowing text, in the same order as the message's `custom_content.skills` array

#### Scenario: Mention inside Markdown formatting

- **WHEN** a user message with a skill mention also contains Markdown, such as `/review this:` followed by a bulleted list, or a mention inside `**bold**` text
- **THEN** the list and the emphasis render as Markdown, and the `ChatSkill` element renders at the mention's position inside the rendered paragraph, list item or emphasis

#### Scenario: Mention inside a code block

- **WHEN** a skill mention's `/{name}` occurrence lies inside a fenced code block or an inline code span
- **THEN** the code renders the literal `/{name}` text at that position, and no `ChatSkill` element is rendered there

#### Scenario: History tooltip

- **WHEN** the pointer rests on any history `ChatSkill` element
- **THEN** the interactive tooltip opens:
  - for a resolved skill, it shows the description (when resolved) and the "View details" button, and "View details" opens the skill details side panel
  - for an unresolved skill, it shows the icon and fixed sentence for that skill's unresolved reason, with no "View details" button

#### Scenario: History tooltip for an unresolved skill

- **WHEN** the pointer rests on a history `ChatSkill` element whose url is unresolved
- **THEN** the interactive tooltip opens showing the icon and fixed sentence for that skill's unresolved reason (trash/`deleted` or lock/`not-shared`), and no "View details" button is rendered

#### Scenario: Assistant message with multiple skill entries

- **WHEN** an assistant message carries more than one `custom_content.skills` entry
- **THEN** all of that message's `ChatSkill` elements render together at the inline-start of its first text line, as a group, unchanged from today's single-slot behavior

#### Scenario: Messages without skills

- **WHEN** a message carries no `skills` entry
- **THEN** no skill slot content and no `ChatSkill` element are rendered, and the user text renders as plain Markdown (see `user-message-markdown`)

#### Scenario: A mention the text no longer contains

- **WHEN** a `custom_content.skills` entry's expected `/{name}` text cannot be located in the message's content (e.g. corrupted or hand-edited data)
- **THEN** that entry renders nowhere in the flowing text: it is neither dropped from the underlying data nor shown as a broken or placeholder element
