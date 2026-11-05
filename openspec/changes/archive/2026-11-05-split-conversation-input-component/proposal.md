## Why

`libs/conversation-input/src/components/Input/Input.tsx` is 1423 lines. With 47 commits in the last 60 days it is the most-changed frontend file, and item F2 of the 2026-10-26 refactoring audit. One `forwardRef` render function owns eight unrelated concerns:

- message state, focus and the imperative handle;
- the `/command` menu: its open state, caret re-evaluation on click, focus and keyup, the empty-query hint, the consume-on-select path and keyboard ownership;
- anchoring the command popup to the trigger word: the caret marker, `ResizeObserver`, mention-mirror insertions and the layout-ordered measurement;
- voice recording: attach-as-audio, transcript merge and the focus restore after recording;
- paste handling (pasted-text expansion, paste-as-attachment, the long-paste warning) and attachments;
- dismissible tool chips, with the phone rule that only switched-on tools get a chip;
- send and the keyboard: the send gesture, history navigation and whole-mention Backspace;
- about 470 lines of JSX: the textarea, the command-menu area, the textarea area with its highlight mirror, and the action row.

A change to one concern means reading past all the others. Hook order matters here as well: the caret anchor must be measured after `useMentionSelectionMirror`'s layout effect. Today that order is held only by a comment 500 lines away from the code it protects.

## What Changes

All new modules are private to the lib. They live under `components/Input/` and are not exported from `src/index.ts`.

- **New hooks** in `components/Input/hooks/`. Each holds code moved from `Input.tsx` unchanged, with the same effects, callbacks and dependency arrays:
  - `useCommandMenuController`: wraps `useCommandMenu`. It owns the textarea click, focus and keyup re-evaluation (with the latest-handler ref and the skip-next-focus ref), the empty-query hint state (`triggerEnd`, `hasCommandEmptyQueryHint`, `markerOffset`), `handleCloseCommandMenu`, the caret-revision restore effect and `handleCommandMenuKeyDown`.
  - `useCommandMenuAnchor`: owns the caret marker and textarea-area refs, `measureCaretAnchor`, the `ResizeObserver` effect, `mirrorInsertions`, the `useMentionSelectionMirror` call and the layout effect that measures after it, in that order, plus `handleTextareaScroll`.
  - `useVoiceInput`: owns `handleAttachAudio`, the transcript merge, `useVoiceRecorder`, `isVoiceActive` and the focus-after-recording effect.
  - `useDismissibleTools`: owns the dismissed-ids state, the reset on a new tool list, `visibleTools` (including the phone rule) and `handleToolDismiss`.
  - `useSendKeyboard`: owns `handleSend`, the send gesture and `handleKeyDown` (history navigation, whole-mention Backspace and the Enter-to-send gate).
  - `usePasteHandling`: owns paste-as-attachment through `useClipboardPaste`, the long-paste warning and reporting pasted text to the command menu.
- **New section components** in `components/Input/`:
  - `InputCommandMenuArea`: the `Dropdown`-based command popup positioned at the caret anchor.
  - `InputTextareaArea`: the textarea, its highlight mirror and the selection overlay.
  - `InputAttachButton`: the `+` attach button and its menu, including the DIAL file-system menu item.

  `InputCommandMenuArea` and `InputTextareaArea` are presentational and receive everything through props. `InputAttachButton` additionally memoizes the file-system menu item.
- **A pure helper**, `components/Input/input-css-vars.ts` (`buildInputCssVars`), maps `colors` to the `--ci-*` CSS variables.
- **`Input.tsx`** keeps:
  - `forwardRef` and the props destructure;
  - the memoized `cssVars`;
  - `useMessageState`, the focus and initial-caret effects and `useImperativeHandle`;
  - `useTextInsertion`, `handleExpandPastedText` (which a spec names in this file), `useAttachments` and the file input;
  - the root and action-row markup that stamps every public `dial-ci-*` class.

  It calls the hooks and renders the sections. It drops to 730 lines.

`usePasteHandling`, `InputAttachButton` and `buildInputCssVars` were added during apply, once the first five hooks and two sections left `Input.tsx` at 830 lines.

No behavior changes:

- the same `InputProps`, `InputHandle`, exports and README;
- the same DOM, class names, `*Colors` CSS variables and `*Labels` strings;
- the same ARIA and live regions, and RTL handling (including the measured-pixel `left`/`top` exception);
- the same keyboard behavior and the same effect timing.

### Non-goals

- Changing any prop, label, color variable, class name or DOM structure.
- Moving the root or action-row markup, or the public-class stamping, out of `Input.tsx`.
- Adding unit tests for the new private hooks. The 11 existing `Input.*.spec.tsx` files already test `Input` by concern through its public behavior, and they stay unchanged as the safety net.
- Splitting `ModelSelectorControl.tsx` or `ConversationInput`, or any other frontend plan item (F3 to F11).

### Acceptance criteria

- `Input.tsx` is under 750 lines (730 at apply time). Each new module has a JSDoc summary and is under 300 lines, except `useCommandMenuController` at 317: more than half of it is the moved explanatory comments, and splitting the menu's caret, hint and keyboard logic further would separate code that changes together.
- Each of the 11 `components/Input/tests/Input.*.spec.tsx` files passes without edits, with the same `it` counts. All other `conversation-input` specs also pass.
- `npm exec nx run-many -t test lint build typecheck -p conversation-input` passes, and `npm run validate:docs` passes. The README and `src/index.ts` are unchanged.
- The `dial-ci-*` classes that `lib-public-class-names` lists for `Input` are still stamped in `components/Input/Input.tsx`. A grep for `CONVERSATION_INPUT_CLASS.` shows the same members there as before.

### Alternatives considered

1. **Hooks only, keep all JSX in `Input.tsx`.** This is the conservative baseline. It leaves about 950 lines, most of them JSX, so it misses the target.
2. **Hooks plus two inner section components, with the root and action row kept in `Input.tsx`** (chosen). It reaches the size target, and keeps every public class and the spec-cited `handleExpandPastedText` where the specs say they are.
3. **A full split into an `InputActionRow` and a `useInputController` that returns everything.** This moves the public-class markup, so `lib-public-class-names` would have to change. A single controller returning 40 values also hides the coupling instead of naming it. Rejected.

### Rollback

The change is internal to the lib. Reverting the commit restores it, with no API, data or host change.

## Capabilities

### New Capabilities

- `conversation-input-decomposition`: which private hook or section owns each concern of the `Input` component, which parts must stay in `Input.tsx`, and the hook-order constraint for the caret anchor.

### Modified Capabilities

None. `lib-public-class-names`, `conversation-draft-persistence` and `url-entity-preselection` cite `components/Input/Input.tsx` for things that stay there.

## Impact

- **Code:** `libs/conversation-input/src/components/Input/`.
  - New: `hooks/useCommandMenuController.ts`, `hooks/useCommandMenuAnchor.tsx` (it renders the marker and hint nodes), `hooks/useVoiceInput.ts`, `hooks/useDismissibleTools.ts`, `hooks/useSendKeyboard.ts`, `hooks/usePasteHandling.ts`, `InputCommandMenuArea.tsx`, `InputTextareaArea.tsx`, `InputAttachButton.tsx` and `input-css-vars.ts`.
  - Edited: `Input.tsx`.
- **Tests:** none edited.
- **Lib boundary:** no host knowledge enters the lib. Everything stays behind the existing props and callbacks, and `apps/chat` is untouched.
- **Docs:** the README documents `Input` by its props, which do not change. No `docs/` file names these internals.
- **Unaffected:**
  - the apps and other libs;
  - i18n: no new strings;
  - RTL and a11y (DOM and ARIA unchanged);
  - feature gating, telemetry and theming.
