## ADDED Requirements

### Requirement: Conversation panel open/closed state persists to localStorage

A `useLocalStorage<T>` hook SHALL be created at `apps/chat/src/hooks/useLocalStorage.ts`. The hook MUST accept a `key: string` and `initialValue: T`, read the stored value from `localStorage` on first render (falling back to `initialValue` if the key is absent or the stored value is unparseable), and write back to `localStorage` on every state update. The hook MUST guard all `localStorage` access with `try/catch` so it degrades gracefully when storage is unavailable (e.g. private browsing, SSR).

State ownership: `app.tsx` owns `isHistoryPanelOpen` via `useLocalStorage('conversationPanelOpen', false)`. The localStorage key is `'conversationPanelOpen'`.

No i18n keys are required for this capability. No new user-visible strings are introduced.

Memoisation: `useLocalStorage` returns a stable setter (wrapped in `useCallback`) so consumers do not re-render unnecessarily when only the setter reference changes.

#### Scenario: Panel state is restored on page reload

- **WHEN** the user opens the conversation panel and reloads the page
- **THEN** the panel renders in the open state without user interaction

#### Scenario: Panel state is restored in closed state on page reload

- **WHEN** the user closes the conversation panel and reloads the page
- **THEN** the panel renders in the closed state without user interaction

#### Scenario: Hook falls back to initialValue when localStorage is unavailable

- **WHEN** `localStorage` throws on read (e.g. storage quota exceeded or security restriction)
- **THEN** `useLocalStorage` returns the `initialValue` and writes are silently skipped

#### Scenario: Hook falls back to initialValue when stored value is malformed JSON

- **WHEN** the value stored under `'conversationPanelOpen'` in `localStorage` is not valid JSON
- **THEN** `useLocalStorage` returns `false` (the `initialValue`) on first render
