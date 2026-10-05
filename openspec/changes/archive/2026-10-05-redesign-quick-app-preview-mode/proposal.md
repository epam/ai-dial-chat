## Why

The Quick App preview currently swaps only the Setup column's iframe for a chat, while the Metadata column, the editor title and a Preview/Exit preview toggle stay on screen. The new design makes preview a distinct, full-page mode: a "Back to setup" header, a "Preview mode" banner that names the app and warns that usage counts against the user's limits, a greeting bubble from the app, and a centred chat column. The goal is to make clear that the author is testing a live app, and that the messages they send cost real quota.

## Problem

- Preview is shown inside the Setup column (`QuickAppSetup.tsx:291-304`), squeezed next to the Metadata form, so it doesn't look like what an end user sees.
- Nothing on screen tells the author that preview messages use their real limits.
- The empty state is only the composer. The app gives no hint about what to do next.
- Exit is a header toggle (`ApplicationFormEditor.tsx:346-371`) with `aria-pressed`, which only makes sense while the editor header stays visible.

## Solution

- **Full-page preview mode.** While previewing, the whole `EntityEditor` (header, Metadata, Setup) is hidden but stays mounted, so the iframe isn't reloaded. A page-level preview surface renders in its place:
  - a header row with a "← Back to setup" button, which is the only way to exit;
  - a "PREVIEW MODE" banner: "You are previewing **{app name}**. Send a message to test how it responds. Usage is following your limits.";
  - the preview chat in a centred column (the existing 760 px `ConversationView` column).
- **Greeting bubble.** A static, non-persisted greeting is shown as an assistant bubble with the app's icon, falling back to its initials: "Test your QuickApp here. Send a message or upload a document to see how it responds." It sits above the composer before the first message and stays at the top of the message list afterwards. The app's own intro text and conversation starters still render below the composer, as they do today.
- **Placeholder** changes to "Send a test message".
- **Preview button** in the editor header only enters preview. It is no longer a toggle, so `aria-pressed`, the `IconEyeOff` state and the "Exit preview" string are removed.
- **Ownership moves up a level.** The preview surface now lives outside the Setup column, so `ApplicationFormEditor` renders it from a new optional `ApplicationEditorDefinition.Preview` component (`QuickAppPreview` for Quick Apps). `ApplicationFormEditor` owns `previewResetKey`, and `QuickAppSetup` asks for a reset through a new `onPreviewReset` Setup prop. This follows the existing definition-driven `Setup` pattern (`apps/chat/src/models/application-editor.ts:144`).

Behaviour that stays the same: save-then-preview orchestration, the saving overlay, the deployment refetch on `hasChanges`, the preview session reset on real changes, deleting the conversation on unmount, the fixed and disabled model chip, full chat feature parity, preview limited to edit mode, and no feature flag.

### Alternatives considered

- **Keep the chat in the Setup column and stretch it full page with CSS** (`fixed inset-0` overlay). Rejected: it fights the `EditorLayout` overflow containers and stacking, puts a full-page surface inside a section that `EntityEditor` thinks it owns, and leaves the Metadata column in the accessibility tree.
- **Portal `AppPreviewChat` from `QuickAppSetup` into a page-level slot.** This would keep ownership in Setup, but it threads a DOM node through props as state, and changing the portal target remounts the chat, which loses the session. Rejected as harder to follow.
- **Add a "preview mode" to `EntityEditor` in `libs/builder-form`.** Rejected: the banner text, greeting and limits notice are specific to this host and app, and the lib already supports what we need (`hideStandardActions`; a hidden wrapper is enough). Not touching the lib avoids a public API change.
- **Chosen: definition-supplied `Preview` component rendered by `ApplicationFormEditor`.** It stays inside `apps/chat`, reuses the existing definition pattern, and keeps both the iframe and the chat mounted.

## Non-goals

- Preview in create mode. It still needs a saved deployment (confirmed with the user).
- Changing the conversation-starter behaviour, the save protocol with the embedded editor, or the conversation lifecycle.
- Preview for other editor kinds (custom apps, agents). They don't supply a `Preview` component.
- Action buttons on the greeting bubble. The mockup shows two icons under it, but the greeting isn't a real message, so copy, regenerate and rate don't apply.
- Any change to `libs/*`.

## What Changes

- `ApplicationFormEditor` renders the definition's `Preview` component next to a hidden (still mounted) `EntityEditor`, owns `previewResetKey`, and turns the header button into an enter-only Preview action.
- New `QuickAppPreview` page component: header with Back to setup, the banner, and `AppPreviewChat`.
- `AppPreviewChat` renders the greeting bubble before and after the conversation exists (using `ConversationView.topContent` after).
- `QuickAppSetup` no longer renders `AppPreviewChat`. It calls `onPreviewReset()` wherever it bumps `previewResetKey` today.
- **BREAKING (internal only):** `ApplicationEditorMessageKeys.exitPreview` and `AppsEditorI18nKeys.ExitPreviewButton` are removed. `ApplicationSetupProps` gains `onPreviewReset` and loses `isPreviewing`.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `app-preview-chat`: preview becomes a full-page mode with a Back to setup header, a banner, a greeting bubble and a new placeholder. The header button only enters preview. Ownership of the reset key moves to `ApplicationFormEditor`.
- `app-editor-flow`: the Quick App page header no longer has an Exit preview toggle, and `QuickAppSetup` no longer hosts `AppPreviewChat`.

## Acceptance criteria

- In edit mode, clicking Preview saves, then shows a full-page preview with the "Back to setup" header, the banner naming the app, the greeting bubble with the app avatar, and the composer placeholder "Send a test message". The editor header, Metadata and Setup columns are not visible and not focusable.
- "Back to setup" brings back the editor in the same state. The iframe is not reloaded and the preview conversation is kept.
- Re-entering preview after a change that reports `hasChanges: true` starts a fresh session. Without changes, the history is kept.
- The greeting is never sent to the model and never appears in the persisted conversation.
- Starters and intro text still render under the composer.
- Works on mobile, in RTL (the back arrow is mirrored), and passes the a11y rules (focus moves into and out of preview, banner text reaches screen readers, every string goes through i18n).
- `apps/chat` tests are updated, and `npm run verify:full` passes.

## Impact

- **Code:** `apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx`, `.../setup/QuickAppSetup.tsx`, `.../setup/AppPreviewChat.tsx`, new `.../setup/QuickAppPreview.tsx`, `.../definitions/quickAppDefinition.tsx`, `apps/chat/src/models/application-editor.ts`, plus their tests (`tests/quickAppDefinition.spec.tsx`, `setup/tests/QuickAppSetup.spec.tsx`, `setup/tests/AppPreviewChat.spec.tsx` if present).
- **i18n:** new strings `appsEditor.previewChat.backToSetup`, `appsEditor.previewChat.bannerLabel`, `appsEditor.previewChat.bannerText`, `appsEditor.previewChat.greeting`. The value of `appsEditor.previewChat.placeholder` changes. `appsEditor.exitPreviewButton` is removed.
- **Libs:** none. `libs/builder-form` and `libs/conversation-messages` are consumed through their existing public props.
- **Backend / API / feature flags:** none.
- **Rollback:** a frontend-only change in one PR; revert the commit. No persisted data or API contract changes.
