## MODIFIED Requirements

### Requirement: Focus and cursor position retained after newline insertion

When a newline-inserting key combination (Shift+Enter with `preference = 'enter'`, or bare Enter with `preference = 'meta-enter'`) is pressed, the `Input` component SHALL:

1. Keep keyboard focus in the textarea — the user MUST NOT need to click the input again.
2. Place the cursor on the new line, immediately after the inserted `\n` — NOT at the start of the text.

This applies to the **first** such key press in a session as well as all subsequent presses. The `Input` layout is always stacked (textarea on its own row above the action bar), so no layout transition accompanies the first newline; focus and caret guarantees are unconditional.

#### Scenario: First Shift+Enter retains focus on new line
- **GIVEN** `preference = 'enter'` AND the message is empty or single-line
- **WHEN** the user presses Shift+Enter for the first time
- **THEN** the textarea retains keyboard focus AND the cursor is positioned at the start of the newly inserted line

#### Scenario: Subsequent Shift+Enter presses retain focus
- **GIVEN** `preference = 'enter'` AND the message already spans multiple lines
- **WHEN** the user presses Shift+Enter
- **THEN** the textarea retains keyboard focus AND the cursor is positioned after the inserted newline
