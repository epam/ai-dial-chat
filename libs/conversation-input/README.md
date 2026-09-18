# @epam/ai-dial-conversation-input

Message input component for conversations, supporting model selection, chat settings, file attachments, voice input, and message editing.

## Overview

`@epam/ai-dial-conversation-input` delivers the complete message-composition experience for AI DIAL Chat conversations. It bundles together every concern that belongs at the bottom of a chat view: a multi-line auto-resizing text area, a model/deployment selector that opens as a bottom sheet on mobile, a chat settings modal for adjusting temperature and system prompts, a voice input bar, and a separate edit-mode input for revising previously sent messages. Keeping all of these in one library means that any application integrating AI DIAL Chat gets a consistent, fully-featured input without assembling the pieces from scratch. Use it whenever a view requires a production-quality chat input. Attachment rendering is a separate concern: import `AttachmentCard`, `AttachmentTray`, `AttachmentGroup`, `FileDndOverlay`, and `getAttachmentIcon` from `@epam/ai-dial-attachment-input` directly — this package does not re-export them.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-conversation-input": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-conversation-input/styles.css';
```

## Peer Dependencies

- `react`
- `react-dom`
- `@epam/ai-dial-chat-shared`
- `@epam/ai-dial-ui-kit`

## Components

### ConversationInput

The primary input component. Renders the text area, attachment tray, action buttons, and model selector. Every prop is optional — the component manages its own local attachment list and textarea state, and reports outward through callbacks. `onSend` receives the message text plus the current local attachments; the model selector is only rendered when `deployments` is supplied.

```tsx
import { ConversationInput } from '@epam/ai-dial-conversation-input';

<ConversationInput
  message={draft}
  placeholder="Type a message"
  welcomeText={welcomeText}
  descriptionText={descriptionText}
  onSend={handleSend}
  onUploadAttachment={uploadAttachment}
  onAttachmentsChange={setDraftAttachments}
  isStreaming={isStreaming}
  onStop={handleStop}
  deployments={availableDeployments}
  selectedDeploymentId={currentDeploymentId}
  onDeploymentChange={handleDeploymentChange}
/>;
```

`pasteTextThreshold` (default `4000`) and `maxMessageLength` (default `50000`)
are two separate rules. `pasteTextThreshold` is the character count above which
pasted plain text becomes an attachment instead of inline content — it applies
only when a text attachment would be accepted, i.e. when both
`isAttachmentsEnabled` (default `true`) and `isTextAttachmentsAllowed`
(default `true`) hold. The host resolves `isTextAttachmentsAllowed` from the
selected model's allowed attachment MIME types — `true` when they accept
`text/plain` (`text/plain` itself, `text/*`, or `*/*`), `false` for models that
accept only other kinds of attachments (e.g. images only), so a long paste
there inserts inline instead of becoming an attachment the model would reject.
`maxMessageLength` caps the message text: sending at or above it is blocked on
**every** model regardless of attachment support,
`onMessageTooLong(length, maxMessageLength)` fires instead, and the textarea
keeps its content. A paste at or above the cap also reports through
`onMessageTooLong` when the paste-to-attachment conversion is disabled (either
flag `false`), since there the pasted text lands inline rather than becoming an
attachment.

`message` and `textInsertion` are two different ways to write into the textarea,
and they are not interchangeable. `message` sets the value: the textarea resyncs
to it whenever the string changes, or whenever `messageRevision` changes if the
string is the same — so anything the user had typed is gone. `textInsertion` puts
its `text` in at the caret each time its `revision` changes and leaves the rest of
the draft alone, and `Ctrl`/`Cmd`+`Z` undoes it. Use `message` to seed or reset the composer, and
`textInsertion` for anything the user triggers while a draft may already exist —
a prompt picked from a library, a snippet, a slash-command expansion.

```tsx
import type { TextInsertion } from '@epam/ai-dial-conversation-input';

const [insertion, setInsertion] = useState<TextInsertion>({
  text: '',
  revision: 0,
});

const handlePromptPicked = (text: string) =>
  setInsertion((prev) => ({ text, revision: prev.revision + 1 }));

<ConversationInput textInsertion={insertion} onSend={handleSend} />;
```

The `revision` is what performs the insert, so bumping it re-inserts the same
string. The value present on mount is never inserted — only a later change to
`revision` is.

The insert itself lands one microtask after the render that requests it, and
leaves the caret after the inserted text. That deferral is what keeps it
undoable and keeps the caret in the composer: performed during the render
instead, the edit is rewritten by React's controlled-value handling — which
clears the browser's undo history — and the menu the text was picked in
reclaims focus as it closes. A test driving this channel has to let the
microtask queue drain before asserting.

`removeLabel` and `retryLabel` are the accessible names of the remove and
retry buttons on each attachment card in the tray. They default to English
(`'Remove attachment'` / `'Retry upload'`); pass translated strings so the two
adjacent buttons stay distinguishable to assistive technology. `uploadingLabel`
(default `'Uploading'`) names the indeterminate progress bar a card shows while
its upload is still in flight.

`sendLabel` (default `'Send message'`) is the send button's accessible name.
`sendTooltip` is an optional hover tooltip. `emptyMessageTooltip` optionally
replaces it when the composer has no non-whitespace text, attachments, or
inline-start slot (such as a selected skill). Other reasons for disabling send,
such as a missing model or blocked attachment, do not select the empty hint.

When `emptyMessageTooltip` is omitted, `sendTooltip` is used in every state,
preserving existing callers. An explicit empty string suppresses the tooltip for
an empty composer. If both props are omitted, no tooltip renders. The accessible
label and send behavior are unaffected.

```tsx
<ConversationInput
  sendTooltip="Send message"
  emptyMessageTooltip="Type a message first"
/>
```

Hosts supply localized strings through these props. The parent chat keeps its
existing `sendTooltip` prop without opting into `emptyMessageTooltip`.

### EditMessageInput

Renders the input in edit mode for revising an existing message. `onCancel` and `onSave` are required; `onSave` receives the new text, the attachments the user kept, and any newly added ones.

```tsx
import { EditMessageInput } from '@epam/ai-dial-conversation-input';

<EditMessageInput
  message={message.content}
  initialAttachments={message.attachments}
  onSave={handleSave}
  onCancel={handleCancel}
  onUploadAttachment={uploadAttachment}
/>;
```

### Input

`Input` and `ConversationInput` accept `onTranscribeAudio?: TranscribeAudio`, where the exported type is `(file: File, signal: AbortSignal) => Promise<string>`. The microphone button (label and tooltip `Dictate`, overridden with `micLabel`) uses this callback with the complete recording after Stop. The library carries no HTTP or provider details; the host owns upload, provider selection, and size validation of the complete file.

One recorder collects all audio until Stop, including pauses. No upload or recognition starts during capture. All recorder blobs, including the final event, form one file with the actual browser MIME type. Sampled silent recordings and recordings shorter than 100 ms are skipped in dictation mode.

Stop finalizes the file and releases the microphone before awaiting recognition. A nonempty result is appended once to the existing draft through `onChange`, with a separating space when needed. The waveform and voice controls replace the textarea while recording or processing, and send/model controls are hidden. The draft remains in memory; no keyboard text entry is available in either voice mode. A polite status region announces the recognized text; the editable draft receives focus once a dictation session ends, including a silent or too-short capture that produced no text. Discard aborts pending work and ignores late results. Cancellation and errors preserve the original draft. On failure, the voice panel closes, the editable draft receives focus, and an inline alert displays the error. A new recording can start without first dismissing the failed session and clears the previous error. No audio is added to the message attachment tray.

`Record voice` appears in the add menu immediately before Chat settings and always creates one audio attachment, even when a transcription callback is supplied. `recordVoiceLabel` overrides its label. The host enables this item with `isVoiceRecordingSupported` (defaults to `isAudioMessageSupported`); attachments must also be enabled and the assistant must not be streaming. Attachment validation, upload and count limits follow the existing attachment pipeline. `isAudioMessageSupported` controls the Dictate button independently. Without a transcription callback, the microphone retains its legacy audio attachment fallback.

Set `isAudioMessageSupported` to show the microphone. Pass translated `transcribingLabel` (default `Transcribing audio…`) and `voiceErrorLabel` (default `Voice input failed`) for processing status and fallback failures, plus the existing microphone/stop/discard labels.

Base text input with auto-resize and keyboard shortcut handling. Use directly when a stripped-down input is needed — `ConversationInput` wraps it with the app-facing props it needs. The layout is always two rows: the textarea on its own full-width row, and the action bar (`+` button, tools chips, model selector, send/stop, mic) below it. Pass `hideActionBar` to render only the textarea and the attachment tray.

`commandMenu` (on both `Input` and `ConversationInput`) mounts a host-injected slash-command menu. When provided, typing the configured `triggerPrefix` as the first character of an empty textarea opens an overlay above the input — as does pasting into an empty textarea a value that is exactly the prefix, or the prefix plus a whitespace-free query (`/` and `/test` trigger; `/s sdf`, multi-line content, or any paste into a non-empty textarea insert as a regular paste and open nothing). The menu stays open while the value keeps matching the prefix followed by a query with no whitespace or second prefix character, and closes on unmatch, Escape, or an outside click; selection typically goes through `ctx.close({ consumeQuery: true })`, which removes the `/query` text from the textarea.

```tsx
import { Input } from '@epam/ai-dial-conversation-input';
```

### ChatSettingsModal

Modal dialog for conversation-level settings. `features` decides which fields render; the modal is uncontrolled — it seeds from the `initial*` props and reports the result through `onSave` when it closes. There is no `isOpen` prop: mount it when open, unmount it when closed.

```tsx
import { ChatSettingsModal } from '@epam/ai-dial-conversation-input';

{
  isSettingsOpen && (
    <ChatSettingsModal
      features={deployment.features}
      initialResponseFormat={settings.responseFormat}
      initialSystemPrompt={settings.systemPrompt}
      initialTemperature={settings.temperature}
      onSave={handleSaveSettings}
      onClose={handleCloseSettings}
    />
  );
}
```

### BottomSheetShell

Layout shell for bottom sheet panels on mobile — header with optional title, back and close buttons, and Escape/backdrop dismissal.

```tsx
import { BottomSheetShell } from '@epam/ai-dial-conversation-input';

<BottomSheetShell
  isOpen={isSheetOpen}
  title="Select a model"
  closeLabel="Close"
  onClose={handleCloseSheet}
>
  {sheetContent}
</BottomSheetShell>;
```

## Public class names

Every composer element a host is likely to restyle carries a stable
`dial-ci-*` class in addition to its internal classes. Target those instead of
hashed CSS-module names, DOM order, or ARIA attributes — all three change
without notice. The names are exported so you never hardcode them:

```tsx
import { CONVERSATION_INPUT_CLASS } from '@epam/ai-dial-conversation-input';

CONVERSATION_INPUT_CLASS.actionRow; // 'dial-ci-action-row'
```

| Class                           | Element                                                           |
| ------------------------------- | ----------------------------------------------------------------- |
| `dial-ci-wrapper`               | The composer's outer bordered container                           |
| `dial-ci-action-row`            | The row holding the textarea, add button, tool chips, and actions |
| `dial-ci-textarea-wrap`         | The textarea cell inside the action row                           |
| `dial-ci-add-cluster`           | The add-attachment button wrapper                                 |
| `dial-ci-tools-chips`           | The tool chips cell inside the action row                         |
| `dial-ci-footer-actions`        | The trailing cluster: model selector, mic, and send/stop buttons  |
| `dial-ci-model-selector-button` | The model selector trigger button, in every presentation          |

`dial-ci-action-row` is absent when `hideActionBar` is set,
`dial-ci-add-cluster` is absent when `hideAddButton` is set, and
`dial-ci-tools-chips` is absent unless `toolsMenuItems` yields at least one
visible tool and `onToolToggle` is supplied.

The model-selector menu carries its own set:

| Class                              | Element                                         |
| ---------------------------------- | ----------------------------------------------- |
| `dial-ci-model-menu`               | The menu root, in all three presentations       |
| `dial-ci-model-menu-search`        | The sticky search header inside the menu        |
| `dial-ci-model-menu-item`          | Every deployment row                            |
| `dial-ci-model-menu-item-selected` | The selected row, **additive** to the row class |

`dial-ci-model-menu` lands on three different presentations, so scope your rule
if you need to distinguish them: the desktop dropdown (a Floating UI portal), a
host-supplied `modelPickerOverlay` dropdown, and the mobile bottom sheet (a
`role="dialog"`). The portal renders outside the composer's DOM subtree, which
is why the menu needs a class of its own rather than a descendant selector from
`dial-ci-wrapper`.

The selected row's **check mark has no class from this package**: it is drawn
by `@epam/ai-dial-ui-kit` from the menu item's `mark`, so nothing here owns that
element. The kit gives it `dial-kit-menuitem-check`, exported as
`DIAL_KIT_CLASS.menuItemCheck` — target that, scoped to the row when you need to
distinguish this menu from other kit menus:

```css
.dial-ci-model-menu-item-selected .dial-kit-menuitem-check {
  color: var(--text-accent);
}
```

`dial-ci-model-menu-item` is emitted for deployment rows only — not for
loading skeletons, nor for the single disabled row shown in the empty and error
states. On mobile only the sheet root is marked; its rows are rendered by a
separate virtualized list and carry no row class.

These classes carry no declarations of their own, so they change nothing until
you style them, and they are additive to `className` and `inputClassName` —
those props keep working exactly as before.

### Replacing fragile selectors

| Instead of                                       | Use                                 |
| ------------------------------------------------ | ----------------------------------- |
| `> div:has(textarea)`                            | `.dial-ci-action-row`               |
| `div.ms-auto`                                    | `.dial-ci-footer-actions`           |
| `button[class*='modelSelectorButton']`           | `.dial-ci-model-selector-button`    |
| `div[role='menu']:has([class*='searchHeader_'])` | `.dial-ci-model-menu`               |
| `[class*='searchHeader_']`                       | `.dial-ci-model-menu-search`        |
| `[class*='selectedItem_']`                       | `.dial-ci-model-menu-item-selected` |

### Stability

A `dial-ci-*` class is public API: renaming it, removing it, or moving it to a
different element is a breaking change, announced in the release notes and
recorded here with its replacement. The element itself stays free — its Tailwind
utilities, its CSS-module class, and its position in the DOM may all change.

Your own overrides are responsible for direction: the class names are
direction-agnostic and identical under `dir="rtl"`, so use CSS logical
properties (`margin-inline-start`, `inset-inline-end`) rather than physical ones.

The full convention — naming grammar, why not BEM, and the rules these classes
follow — is in
[`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

## Enums

```tsx
import { SendOnEnter } from '@epam/ai-dial-conversation-input';

SendOnEnter.Enter; // Enter submits; Shift+Enter inserts a newline
SendOnEnter.MetaEnter; // ⌘/Ctrl+Enter submits; bare Enter inserts a newline
```

```tsx
import { ActionRowLayout } from '@epam/ai-dial-conversation-input';

ActionRowLayout.Stacked; // textarea on its own line, controls wrap below (default)
ActionRowLayout.Inline; // add button, textarea and footer actions share one line
```

### Action row layout

`actionRowLayout` chooses how `Input` and `ConversationInput` arrange the
textarea and the controls around it. It defaults to `ActionRowLayout.Stacked`,
which is the layout the composer has always had: the textarea takes the whole
first line and the add button, tool chips, and footer actions wrap below it.

```tsx
<ConversationInput
  actionRowLayout={ActionRowLayout.Inline}
  onSend={handleSend}
/>
```

`ActionRowLayout.Inline` puts the add button, the textarea, and the footer
actions on one line. Tool chips are variable-width, so they move to a row of
their own above the action row rather than competing for the line.

The layout is ignored on mobile, where one line does not fit — you do not need
to branch on viewport yourself.

Neither layout uses an `order-*` utility: each renders its children in the
order they appear on screen, so the tab order always matches the visual order.
If you were previously reordering the row from the host with container queries,
drop that override — it desynchronises focus order from what the user sees.

## Building

```sh
npm exec nx build conversation-input
```

## Testing

```sh
npm exec nx test conversation-input
```
