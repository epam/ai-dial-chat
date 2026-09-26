# stream-error-banner Specification

## Purpose

The friendly error banner on a failed assistant message: localized fallback text in place of raw transport errors, the inline "Try again" action, and its accessibility and RTL contract.

## Requirements

### Requirement: A failed assistant message shows a friendly error banner
A failed assistant message SHALL show a titled, localized error banner.
`ConversationMessageItem` (`apps/chat/src/components/ConversationView/ConversationMessageItem.tsx`)
SHALL render, for any assistant message whose `streamErrorMessage` is not
`null`/`undefined`, one `ErrorMessageNotification` (from
`@epam/ai-dial-ui-kit`) below the message content with:

- `title` = `t('chat.streamErrorTitle')` — "Couldn't finish this response"
- `message` = the `streamErrorMessage` value when it is non-empty (upstream
  DIAL Core text), otherwise `t('chat.streamError')` — "Something went wrong
  while generating the response. Try again in a moment."

The banner SHALL NOT render any other text derived from the error. State is
owned by the persisted/streamed conversation message (`streamErrorMessage`,
read through the existing `useConversationStream` flow); no new context or
hook is introduced. The message's partial content, if any, SHALL remain
rendered above the banner as today.

i18n keys (`apps/chat/src/i18n/locales/en.json`, `ChatI18nKeys` in
`apps/chat/src/constants/translation-keys.ts`):

| Key | Enum member | English text |
|---|---|---|
| `chat.streamErrorTitle` (new) | `StreamErrorTitle` | Couldn't finish this response |
| `chat.streamError` (reworded) | `StreamError` | Something went wrong while generating the response. Try again in a moment. |
| `buttons.tryAgain` (new, shared) | `ButtonsI18nKeys.TryAgain` | Try again |

`chat.streamError` is also used by the stop-failure toast
(`Conversation.tsx`, `AppPreviewChat.tsx`); the reworded text is accepted
there.

#### Scenario: Empty error value shows the localized fallback
- **WHEN** an assistant message has `streamErrorMessage: ''`
- **THEN** the banner shows the title "Couldn't finish this response" and
  the message "Something went wrong while generating the response. Try
  again in a moment."

#### Scenario: Upstream error text is shown under the same title
- **WHEN** an assistant message has `streamErrorMessage: 'Rate limit exceeded'`
- **THEN** the banner shows the title "Couldn't finish this response" and
  the message "Rate limit exceeded"

#### Scenario: A successful message shows no banner
- **WHEN** an assistant message has no `streamErrorMessage`
- **THEN** no error banner and no "Try again" button are rendered

### Requirement: The error banner offers an inline "Try again" action
The banner SHALL contain a "Try again" button (label
`t(ButtonsI18nKeys.TryAgain)`) that calls the item's existing
`onRegenerateMessage(messageIndex)` prop — the same action as the
action-bar Regenerate control, with no new retry logic. The button SHALL
follow the same gating as that control:

- not rendered when `onRegenerateMessage` is absent, or when the
  `OverlayFeature.HideRegenerateAssistantMessage` UI feature is on;
- rendered but disabled while `isAssistantTyping` is `true`.

No `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES` gate applies; the only
gate is the existing overlay UI feature above. The action-bar Regenerate
control on an errored message is unchanged.

The button SHALL use the UI kit 2.0 `Button` (confirmed via the UI kit MCP
during implementation) with a text label; any icon inside it SHALL get
`aria-hidden` and `stroke={DIAL_KIT_ICON_STROKE}`.

`onRegenerateMessage` is already a stable callback from the page; the
inline handler SHALL be wrapped in `useCallback` keyed on
`onRegenerateMessage` and the message index so the memoized item is not
re-rendered by a new function identity.

#### Scenario: Clicking Try again regenerates the failed message
- **WHEN** the user activates "Try again" on the banner of the assistant
  message at index 3
- **THEN** `onRegenerateMessage` is called once with `3`

#### Scenario: Try again is hidden when regeneration is hidden
- **WHEN** `OverlayFeature.HideRegenerateAssistantMessage` is enabled, or
  `onRegenerateMessage` is not provided
- **THEN** the banner renders without a "Try again" button

#### Scenario: Try again is disabled while the assistant is typing
- **WHEN** `isAssistantTyping` is `true`
- **THEN** the "Try again" button is rendered and disabled, and activating
  it does not call `onRegenerateMessage`

### Requirement: The error banner is accessible and direction-agnostic
The banner SHALL keep the UI kit's `role="alert"` live region so the error
is announced when it appears. "Try again" SHALL be a native button,
reachable with Tab and operable with Enter/Space, whose accessible name is
its visible translated label; focus SHALL NOT be moved automatically when
the banner appears. Text colors come from the UI kit's error variant tokens
(no hardcoded fallbacks).

RTL: layout between the message text and the button SHALL use logical
properties only (`gap-*`, `ms-*`/`me-*`, `text-start`), so the button sits
at the inline end in both `ltr` and `rtl`. Any refresh icon is
non-directional and SHALL NOT be mirrored.

Observability: none added in the UI; raw error detail is logged by
chat-api (backend) and handed to the host via `onStreamError` (frontend).
No cache is introduced.

#### Scenario: Try again is found by role and name
- **WHEN** a failed assistant message is rendered
- **THEN** `getByRole('button', { name: 'Try again' })` finds the control
  inside the element with `role="alert"`

#### Scenario: Keyboard activation
- **WHEN** the user focuses "Try again" with Tab and presses Enter
- **THEN** `onRegenerateMessage` is called with that message's index
