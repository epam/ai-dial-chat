### Requirement: Host provides message history to ConversationInput

`ConversationInput` SHALL accept an optional prop `messageHistory?: readonly string[]` containing the user-authored messages for the current conversation in chronological order (oldest at index 0, most recent at the last index). The host (app) is responsible for deriving this list from its conversation state and passing it in. When omitted or empty, keyboard history navigation is disabled.

- **State owner:** `ConversationView.tsx` derives `messageHistory` from the active conversation's messages filtered to `role === 'user'` and maps to their `content` strings.
- **App-level adapter contract:** `ConversationView` owns the filtering/mapping; `ConversationInput` receives a plain `string[]`.
- **Feature gate:** None — always enabled when `messageHistory` is provided.
- **No new i18n keys** — no user-visible strings introduced.
- **RTL impact:** None — this is behavioural, not layout.
- **Accessibility:** Keyboard-only interaction; no ARIA additions required.
- **Observability:** None required.

#### Scenario: History prop is omitted

- **WHEN** `ConversationInput` is rendered without a `messageHistory` prop
- **THEN** pressing Up or Down arrow in the textarea behaves as the browser default (cursor movement)

#### Scenario: History prop is an empty array

- **WHEN** `ConversationInput` is rendered with `messageHistory={[]}`
- **THEN** pressing Up arrow in the textarea behaves as the browser default

---

### Requirement: Up arrow recalls the previous sent message

When the cursor is on the first line of the textarea (no newline character before `selectionStart`) and the user presses Up, the system SHALL:

1. On the first press — save the current unsent draft (including empty string) and display the most-recent message from `messageHistory`.
2. On each subsequent press — display the next older message, cycling back to the oldest.
3. When already at the oldest entry — do nothing (do not wrap around).

The Up key event SHALL be prevented from propagating to avoid unexpected browser scroll behaviour.

#### Scenario: First Up press with non-empty draft

- **WHEN** the user has typed a draft ("provide spring annotation configuration") and presses Up with the cursor on line 1
- **THEN** the draft is saved internally and the textarea shows the most recent message from history

#### Scenario: Repeated Up presses

- **WHEN** the user presses Up multiple times
- **THEN** each press loads the next older message, until the oldest is reached

#### Scenario: Up at oldest entry

- **WHEN** the user is viewing the oldest history entry and presses Up
- **THEN** the textarea content is unchanged

#### Scenario: Up with cursor mid-content (not first line)

- **WHEN** the textarea has multiple lines and the cursor is on line 2 or below
- **THEN** pressing Up moves the cursor to the previous line (default browser behaviour); no history navigation occurs

#### Scenario: Up during IME composition

- **WHEN** the user has an active IME composition (e.g. Japanese input)
- **THEN** pressing Up does not trigger history navigation (event has `isComposing === true`)

#### Scenario: Up when input is streaming or disabled

- **WHEN** `isStreaming` or `isInputDisabled` is `true`
- **THEN** pressing Up does not trigger history navigation

---

### Requirement: Down arrow returns toward the current draft

When the user is in history navigation mode (index ≥ 0) and the cursor is on the last line of the textarea, pressing Down SHALL display the next more-recent history entry. When already at the most-recent history entry, pressing Down SHALL restore the saved draft and exit history mode (index returns to -1).

#### Scenario: Down from a history entry

- **WHEN** the user has navigated Up and then presses Down with cursor on the last line
- **THEN** the next more-recent history entry is displayed

#### Scenario: Down from most-recent history entry restores draft

- **WHEN** the user is viewing the most-recent history entry and presses Down
- **THEN** the textarea shows the previously saved draft and history mode is exited

#### Scenario: Down with cursor mid-content (not last line)

- **WHEN** the textarea has multiple lines and the cursor is not on the last line
- **THEN** pressing Down moves the cursor to the next line (default browser behaviour); no history navigation occurs

#### Scenario: Down when not in history mode

- **WHEN** the user has not pressed Up (index is -1)
- **THEN** pressing Down behaves as the browser default

---

### Requirement: Editing while in history mode resets navigation

When the user modifies the textarea content while viewing a history entry (index ≥ 0), the system SHALL exit history mode (reset index to -1) and discard the saved draft. Subsequent Up/Down presses start a fresh navigation from the new content.

#### Scenario: User edits a recalled history entry

- **WHEN** the user has navigated to a history entry and then types or deletes characters
- **THEN** history mode is exited; the current textarea content becomes the new working draft

---

### Requirement: Sending resets history navigation state

When the user submits a message (`onSend` fires), the navigation index SHALL reset to -1 and the saved draft SHALL be cleared, so the next Up press starts navigation from the newly submitted message's position in the updated history.

#### Scenario: Send while in history mode

- **WHEN** the user has navigated to a history entry and presses Enter to send it
- **THEN** the message is sent, history mode is exited, and the input clears as normal

#### Scenario: Send from draft mode

- **WHEN** the user sends a new message without having used history navigation
- **THEN** no change to navigation state (already at -1)

---

### Requirement: useInputHistoryNavigation hook is unit-testable

The lib SHALL export a `useInputHistoryNavigation` hook from `libs/conversation-input/src/hooks/useInputHistoryNavigation.ts`. The hook SHALL expose:

- `navigate(direction: 'up' | 'down', currentValue: string, cursorPos: number): string | null` — returns the new textarea value, or `null` if the key should not be intercepted (cursor not on first/last line, or no history available in that direction).
- `notifyChange(newValue: string): void` — call on every textarea onChange to reset history mode when the user edits.
- `reset(): void` — call on send to clear navigation state.

**Memoisation:** The hook's returned object SHALL be stable (same reference) between renders when no navigation state changes, to avoid unnecessary Input re-renders.

#### Scenario: navigate up on first line with history

- **WHEN** `navigate('up', 'draft text', 0)` is called with `history = ['msg1', 'msg2']`
- **THEN** returns `'msg2'` (most recent)

#### Scenario: navigate returns null when cursor is not on first line

- **WHEN** `navigate('up', 'line1\nline2', 8)` is called (cursor on line 2, index 8 > position of first newline)
- **THEN** returns `null`

#### Scenario: navigate down at draft position returns null

- **WHEN** `navigate('down', 'draft', 5)` is called with index at -1
- **THEN** returns `null`
