# Keyboard Shortcut Preference

## Purpose

The persisted Enter vs. Meta+Enter send preference and how the chat inputs honor it.

## Overview

The application allows users to choose their preferred send-key shortcut for the chat input. The preference is persisted to `localStorage` and applied immediately to the input behavior.

---

## Requirement: Keyboard shortcut preference persisted to localStorage

The application SHALL store the user's preferred send-key shortcut under `StorageKey.KeyboardShortcut` in `localStorage`. Valid values are `'enter'` and `'meta-enter'`. The default value when no entry exists SHALL be `'enter'`.

A hook `useKeyboardShortcutPreference` SHALL expose `{ preference, setPreference }` where:
- `preference` is `'enter' | 'meta-enter'`
- `setPreference(value)` writes the value to localStorage and updates local state

### Scenario: Default preference when no stored value exists
- **WHEN** `localStorage` has no entry for `StorageKey.KeyboardShortcut`
- **THEN** `useKeyboardShortcutPreference` returns `preference = 'enter'`

### Scenario: Stored value is loaded on mount
- **WHEN** `localStorage` contains `StorageKey.KeyboardShortcut = 'meta-enter'`
- **THEN** `useKeyboardShortcutPreference` returns `preference = 'meta-enter'`

### Scenario: Calling setPreference persists and updates the value
- **WHEN** `setPreference('meta-enter')` is called
- **THEN** `localStorage` is updated to `'meta-enter'` AND subsequent reads of `preference` return `'meta-enter'`

### Scenario: Preference change is reflected in all hook instances immediately
- **GIVEN** multiple components each call `useKeyboardShortcutPreference()` (e.g. settings menu and the chat input)
- **WHEN** `setPreference` is called in one instance (e.g. the user selects a new option in settings)
- **THEN** all other mounted instances update their `preference` value on the same render cycle — no page reload or navigation is required

---

## Requirement: Chat input respects the keyboard shortcut preference

The chat input send handler SHALL read `useKeyboardShortcutPreference` and apply the following rules:

- When `preference = 'enter'`: pressing **Enter** (without Shift/Ctrl/Meta) SHALL submit the message; pressing **Shift+Enter** SHALL insert a newline.
- When `preference = 'meta-enter'`: pressing **⌘+Enter** (macOS) or **Ctrl+Enter** (Windows/Linux) SHALL submit the message; pressing bare **Enter** SHALL insert a newline.

### Scenario: Enter sends when preference is enter
- **WHEN** `preference = 'enter'` AND the user presses Enter without modifier keys
- **THEN** the message is submitted

### Scenario: Shift+Enter inserts newline when preference is enter
- **WHEN** `preference = 'enter'` AND the user presses Shift+Enter
- **THEN** a newline is inserted and the message is NOT submitted

### Scenario: Meta+Enter sends when preference is meta-enter
- **WHEN** `preference = 'meta-enter'` AND the user presses ⌘+Enter (macOS) or Ctrl+Enter (Windows/Linux)
- **THEN** the message is submitted

### Scenario: Bare Enter inserts newline when preference is meta-enter
- **WHEN** `preference = 'meta-enter'` AND the user presses Enter without modifier keys
- **THEN** a newline is inserted and the message is NOT submitted

---

## Requirement: New chat screen input respects the keyboard shortcut preference

The conversation input rendered on the new chat (landing) screen — before any conversation is created — SHALL read `useKeyboardShortcutPreference` and pass the resulting value to `ConversationInput` as the `sendOnEnter` prop, identical to the behaviour of the existing conversation view.

### Scenario: Preference is applied on the new chat screen
- **GIVEN** the user has set `preference = 'meta-enter'`
- **WHEN** the user opens the new chat screen (no conversation selected)
- **THEN** pressing bare Enter inserts a newline and pressing ⌘+Enter / Ctrl+Enter submits the message

### Scenario: Default preference is applied on the new chat screen
- **GIVEN** no preference has been stored in localStorage
- **WHEN** the user opens the new chat screen
- **THEN** pressing bare Enter submits the message (default `'enter'` behaviour)

---

## Requirement: Focus and cursor position retained after newline insertion

When a newline-inserting key combination (Shift+Enter with `preference = 'enter'`, or bare Enter with `preference = 'meta-enter'`) is pressed and the textarea layout transitions from single-line (non-stacked) to multi-line (stacked), the `Input` component SHALL:

1. Keep keyboard focus in the textarea — the user MUST NOT need to click the input again.
2. Place the cursor on the new line, immediately after the inserted `\n` — NOT at the start of the text.

This applies to the **first** such key press in a session (when the textarea moves from the inline row into the stacked position) as well as all subsequent presses.

### Scenario: First Shift+Enter retains focus on new line
- **GIVEN** `preference = 'enter'` AND the textarea is in single-line (non-stacked) layout
- **WHEN** the user presses Shift+Enter for the first time
- **THEN** the textarea retains keyboard focus AND the cursor is positioned at the start of the newly inserted line

### Scenario: Subsequent Shift+Enter presses retain focus
- **GIVEN** `preference = 'enter'` AND the textarea is already in stacked layout
- **WHEN** the user presses Shift+Enter
- **THEN** the textarea retains keyboard focus AND the cursor is positioned after the inserted newline
