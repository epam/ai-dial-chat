## Context

The chat input (`libs/conversation-input` → `Input.tsx`) today only handles the Enter key in its `handleKeyDown` handler; all other keys return early. The component manages its own textarea value via `useState` and exposes an optional `message` prop for one-way initialisation.

`ConversationView.tsx` renders `ConversationInput` and has access to the full conversation message list, but does not currently pass any history to the input. The lib is host-agnostic and must not read app state directly.

## Goals / Non-Goals

**Goals:**
- Pressing Up in the chat input recalls the previous sent message into the textarea.
- Pressing Down returns toward the current draft.
- The unsent draft is preserved and restored when the user navigates back past the last entry.
- Navigation resets (returns to draft) when the user starts typing while in history mode.
- History is driven by whatever the host passes in — no lib-level state store.

**Non-Goals:**
- Persisting history across page reloads or conversations.
- Navigating while the input is in streaming/disabled state.
- Fuzzy search or prefix-based filtering (shell `Ctrl+R` style).
- Changing the `EditMessageInput` component (inline edit flow is separate).

## Decisions

### D1 — Pass history as a prop, not via context

**Decision:** Add `messageHistory?: readonly string[]` to `ConversationInput`'s props and thread it down to `Input`.

**Rationale:** Libs must not import app contexts, routing, or storage (AGENTS.md §Library isolation). Passing an array of strings is the narrowest, most testable boundary — the lib never knows which conversation it belongs to or how messages are fetched.

**Alternative considered:** A context provider in `apps/chat` that the lib reads. Rejected — would couple the lib to app-level context shape and violate the isolation rule.

### D2 — Self-contained `useInputHistoryNavigation` hook inside the lib

**Decision:** Extract navigation logic into `libs/conversation-input/src/hooks/useInputHistoryNavigation.ts`. The hook owns:
- Current history index (`-1` = draft mode, `0` = oldest, `history.length - 1` = most recent).
- Saved draft string (captured when entering history mode from draft mode).
- `handleArrowUp(currentValue, cursorPos)` and `handleArrowDown(currentValue, cursorPos)` helpers that return the new textarea value to show, or `null` if the key should not be intercepted.
- `handleChange(newValue)` — resets the index to `-1` and clears the saved draft.
- `reset()` — called on send to clear all state for the new draft.

`Input.tsx` calls the hook and wires the returned value into the existing internal `useState` setter.

**Alternative considered:** Inline the logic directly in `Input.tsx`. Rejected — harder to unit-test and creates a large handler function.

### D3 — Trigger condition: cursor on first / last line only

**Decision:**
- **Up** is intercepted only when the cursor's current line is line 0 of the textarea (i.e. there is no `\n` before `selectionStart`).
- **Down** is intercepted only when the cursor is on the last line (no `\n` from `selectionStart` to end), **and** the navigation index is not `-1` (not in draft mode).

**Rationale:** In a multiline textarea, Up/Down normally moves the cursor between lines. Hijacking those keys while the cursor is mid-content would break normal editing. Matching only the first/last line mirrors the behaviour of Discord, Slack, and Google Gemini.

**Alternative considered:** Intercept regardless of cursor position (shell behaviour). Rejected — a textarea is not a single-line terminal; multiline prompts are common.

### D4 — History ordering: most-recent first on first Up press

**Decision:** The host provides `messageHistory` in chronological order (oldest first). The hook navigates it in reverse: first Up press shows `history[history.length - 1]` (most recent), subsequent presses go further back.

**Alternative considered:** Host provides history pre-reversed. Rejected — chronological order is natural for the host (it reads messages in conversation order) and reversing once inside the hook is trivial.

### D5 — Controlling the textarea value

**Decision:** `Input.tsx` already has an internal `value` state. When the navigation hook returns a non-null value from an arrow key press, `Input.tsx` calls `setValue(navigationValue)` and `e.preventDefault()`. This keeps the existing controlled/uncontrolled textarea contract unchanged for the host.

## Risks / Trade-offs

- **Cursor position after navigation** — After loading a history entry the cursor lands at the end of the string (default browser behaviour after a value set). This matches shells and Gemini. Intentional.
- **IME / composition** — Up/Down during active IME composition should not trigger navigation. Handled by checking `e.isComposing` before intercepting.
- **Long history lists** — The hook holds the full array reference but never copies or mutates it; memory cost is the prop reference only.
- **Stale `messageHistory` prop** — If the host updates `messageHistory` while the user is mid-navigation (e.g. an in-flight message arrives), the index stays valid as long as the new array is longer; if shorter (messages deleted), clamp the index to the new length. Risk is low in practice.

## Migration Plan

Pure additive frontend change; no API or data-model migration needed. The new prop is optional — all existing `ConversationInput` consumers work unchanged with `messageHistory` omitted.

## Open Questions

- Should voice-transcribed messages be included in the history passed to the input? (Likely yes — the host decides what to include.)
- Should the history exclude messages that are actively being edited via `EditMessageInput`? (Probably yes — the host should filter them out.)
