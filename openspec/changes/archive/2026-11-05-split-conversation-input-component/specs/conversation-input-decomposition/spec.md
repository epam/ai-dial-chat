## ADDED Requirements

### Requirement: Input concerns live in private hooks and sections

`Input` (`libs/conversation-input/src/components/Input/Input.tsx`) SHALL delegate its concerns to private modules under `libs/conversation-input/src/components/Input/`. None of them is exported from `libs/conversation-input/src/index.ts`.

| Module | Owns |
| --- | --- |
| `hooks/useCommandMenuController.ts` | the `useCommandMenu` wiring; textarea click, focus and keyup re-evaluation; the empty-query hint state; `handleCloseCommandMenu`; the caret-revision restore; `handleCommandMenuKeyDown` |
| `hooks/useCommandMenuAnchor.tsx` | the caret marker; `measureCaretAnchor`; the `ResizeObserver` re-measure; the mirror insertions; the `useMentionSelectionMirror` call; the post-mirror layout measurement; the scroll sync |
| `hooks/useVoiceInput.ts` | attach-as-audio; the transcript merge; `useVoiceRecorder`; `isVoiceActive`; the focus restore after recording |
| `hooks/useDismissibleTools.ts` | dismissed tool ids, reset when the tool list changes; `visibleTools`, including the phone rule; `handleToolDismiss` |
| `hooks/useSendKeyboard.ts` | `handleSend`; the send gesture; `handleKeyDown` (history navigation, whole-mention Backspace, Enter-to-send) |
| `hooks/usePasteHandling.ts` | paste-as-attachment through `useClipboardPaste`; the long-paste warning; reporting pasted text to the command menu |
| `InputCommandMenuArea.tsx` | the command popup markup, positioned at the measured caret anchor |
| `InputTextareaArea.tsx` | the textarea, its highlight mirror and the selection overlay |
| `InputAttachButton.tsx` | the `+` attach button and its menu, including the DIAL file-system menu item |
| `input-css-vars.ts` | `buildInputCssVars`, which maps the `colors` prop to the `--ci-*` CSS variables |

`Input.tsx` SHALL keep:

- the props destructure, and the memoized `cssVars` built with `buildInputCssVars`;
- message state, the focus and initial-caret effects and `useImperativeHandle`;
- `useTextInsertion`, `handleExpandPastedText`, `useAttachments` and the file input;
- the root and action-row markup that stamps every `dial-ci-*` class listed for `Input` in `lib-public-class-names`.

Each hook and section SHALL hold code moved without behavioral change. Its effect dependency arrays SHALL stay the same, except that a ref which becomes a hook parameter is added to the arrays that read it. Each module SHALL have a JSDoc summary.

The split adds no prop, label, color variable, class name, DOM node, ARIA attribute or live-region message. `InputProps`, `InputHandle` and the README stay as they are. RTL handling stays as it is, including the measured-pixel `left`/`top` of the command popup. The split introduces no feature gate, telemetry, cache or host integration.

#### Scenario: Existing Input behavior specs pass unchanged

- **WHEN** the 11 `libs/conversation-input/src/components/Input/tests/Input.*.spec.tsx` files run against the split component without edits
- **THEN** every case passes, with the same number of `it` cases as before the split

#### Scenario: Public surface is unchanged

- **WHEN** `libs/conversation-input/src/index.ts` and the README are compared before and after the split
- **THEN** both are unchanged, and every `CONVERSATION_INPUT_CLASS` member that `Input.tsx` used before is still used in `Input.tsx`

### Requirement: The caret anchor is measured after the mention mirror syncs

Inside `useCommandMenuAnchor`, the `useMentionSelectionMirror` call SHALL come before the `useLayoutEffect` that runs `measureCaretAnchor`. The mirror's own layout effect therefore scrolls the mirror into sync before the caret marker inside it is measured. The hook SHALL be called from `Input` after `useCommandMenuController`, because it reads `markerOffset`, `triggerEnd` and the hint state from that hook.

#### Scenario: Mirror sync precedes the anchor measurement

- **WHEN** `hooks/useCommandMenuAnchor.tsx` is inspected
- **THEN** its `useMentionSelectionMirror` call precedes the `useLayoutEffect` that calls `measureCaretAnchor`, and the mirror scroll-sync cases in `Input.mentions.spec.tsx` still pass

jsdom has no layout, so the measured pixel position is checked manually in the running app: a `/` trigger typed after enough lines to scroll the textarea opens the popup at the trigger word.
