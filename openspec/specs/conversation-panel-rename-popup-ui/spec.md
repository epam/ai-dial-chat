# conversation-panel-rename-popup-ui Specification

## Purpose

Component-level contract for `RenameConversationPopup`, a controlled, labels-driven popup exported by `@epam/ai-dial-conversation-panel` with no i18n, context, or API dependency — all user-visible strings and external operations are supplied by the app.

## Requirements

### Requirement: RenameConversationPopup is a controlled, labels-driven component owned by `libs/conversation-panel`

`@epam/ai-dial-conversation-panel` SHALL export a `RenameConversationPopup` component and its
`RenameConversationPopupProps`/`RenameConversationPopupLabels` types from the package root. The component
SHALL accept `isOpen: boolean`, `currentTitle: string`, `isSaving: boolean`, `error: string | null`,
`onSave: (newTitle: string) => void`, `onCancel: () => void`,
`onGenerateWithAi: () => Promise<string>`, and a `labels` object carrying every user-visible string. The
component SHALL NOT import `react-i18next`, any translation-key constant, an application Context, an API
call, or a routing utility.

#### Scenario: Architecture guard — no i18n, context, or API import
- **WHEN** `libs/conversation-panel` is linted and type-checked
- **THEN** `RenameConversationPopup`'s source file contains no `react-i18next` import, no application
  Context import, and no `server-api`/generated-client import

### Requirement: Title reset and deferred focus on open

Whenever `isOpen` transitions to `true`, the component SHALL reset its internal input value to
`currentTitle`, clear any previous AI-generation error, and place focus on the input after the popup has
had a chance to mount (deferred via a zero-delay timer, matching the current behavior).

#### Scenario: Reopening resets to the current title
- **GIVEN** the popup was previously open with edited text, then closed
- **WHEN** `isOpen` becomes `true` again with a possibly different `currentTitle`
- **THEN** the input value is reset to the new `currentTitle` and receives focus

### Requirement: Save validation — trimming, trailing-dot removal, emptiness, unchanged value, and byte length

The component SHALL compute the candidate save value as `stripTrailingDots(value.trim())` using the
`chat-shared` string utilities. The Save action SHALL be disabled while the candidate value is empty,
while the candidate value equals `currentTitle.trim()`, or while the candidate
value's UTF-8 byte length (via `chat-shared`'s `getUtf8ByteLength`) exceeds 255. When the byte-length
limit is exceeded, the component SHALL show `labels.nameTooLongError` and this message SHALL take
precedence over any AI-generation error or the `error` prop.

#### Scenario: Save disabled when unchanged
- **WHEN** the input value trims to the same text as `currentTitle.trim()`
- **THEN** Save is disabled

#### Scenario: Save disabled when empty or whitespace-only
- **WHEN** the input value is empty or whitespace-only
- **THEN** Save is disabled

#### Scenario: Save disabled over the byte-length limit
- **WHEN** the trimmed, trailing-dot-stripped value's UTF-8 byte length exceeds 255
- **THEN** Save is disabled and `labels.nameTooLongError` is shown

#### Scenario: Enter key triggers save
- **WHEN** the input has focus, the value is valid, and the user presses Enter
- **THEN** `onSave` is called with the trimmed, trailing-dot-stripped value

### Requirement: Sanitization while typing and after AI generation

Every keystroke SHALL pass the input value through `chat-shared`'s `sanitizeConversationName`, stripping
the prohibited-character set (tab, `"`, `:`, `;`, `/`, `\`, `,`, `=`, `{`, `}`, `%`, `&`) before it is
reflected in the field. A successful AI-generated name SHALL be sanitized the same way before being set
as the input value.

#### Scenario: Prohibited characters never appear while typing
- **WHEN** the user types a character from the prohibited set
- **THEN** it is not reflected in the input value

#### Scenario: AI-generated name is sanitized
- **WHEN** `onGenerateWithAi` resolves with a name containing a prohibited character
- **THEN** the input value is set to the sanitized name with that character removed

### Requirement: AI-generation affordance, concurrency guard, and separate error handling

The component SHALL render an AI-generation trigger that calls `onGenerateWithAi()`. While a generation
request is in flight, the trigger SHALL show a loading indicator in place of its icon and SHALL be
disabled, together with disabling re-entry into a second concurrent generation. On success, the input
value SHALL be replaced with the sanitized generated name. On failure, the component SHALL show
`labels.renameWithAiError` as a distinct error, without discarding the current input value, and SHALL NOT
propagate the failure into the `error` prop's display slot. Closing and reopening the popup SHALL
invalidate an earlier in-flight generation so its result cannot overwrite the new session's title.

#### Scenario: Generation in progress disables the trigger and shows a spinner
- **WHEN** `onGenerateWithAi()` has been called and has not yet settled
- **THEN** the AI-generation trigger is disabled and shows a loading indicator

#### Scenario: A second generation attempt is ignored while one is in flight
- **WHEN** the user activates the AI-generation trigger while a previous call has not settled
- **THEN** `onGenerateWithAi` is not called a second time

#### Scenario: A stale generation cannot overwrite a reopened popup
- **GIVEN** generation started before the popup was closed
- **WHEN** the popup reopens with a new `currentTitle` and the old generation resolves
- **THEN** the input keeps the new session's `currentTitle`

#### Scenario: Generation failure shows a distinct error and preserves input
- **WHEN** `onGenerateWithAi()` rejects
- **THEN** `labels.renameWithAiError` is shown and the input value is unchanged

### Requirement: Saving state replaces content with a loading indicator

While `isSaving` is `true`, the component SHALL replace its input/footer content with a loading
indicator rather than rendering the input, Save, and Cancel controls.

#### Scenario: Saving state hides the input and buttons
- **WHEN** `isSaving` is `true`
- **THEN** a loading indicator is shown and the input/Save/Cancel controls are not rendered

### Requirement: Error precedence

When more than one error condition applies simultaneously, the component SHALL display exactly one
message, in this precedence order: the byte-length validation error, then the AI-generation error, then
the `error` prop.

#### Scenario: Byte-length error takes precedence over the error prop
- **GIVEN** `error` is a non-null API error message and the current input also exceeds the byte-length
  limit
- **WHEN** the component renders
- **THEN** only the byte-length validation message is shown

### Requirement: Component tests move to `libs/conversation-panel`

`libs/conversation-panel` SHALL own the component-level Vitest/@testing-library/react test suite for
`RenameConversationPopup`, covering every scenario above. `apps/chat` SHALL keep only a thin wiring test
that renders the real component connected to its real save/AI-generation operations and a real
`useTranslation`-backed labels object.

#### Scenario: App wiring test catches a broken label wire-up
- **WHEN** the app-level wiring test renders `RenameConversationPopup` through the app's real
  label-building code
- **THEN** it asserts a specific translated string (not a translation key) is present in the DOM
