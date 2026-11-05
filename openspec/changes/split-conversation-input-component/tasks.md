Slicing: one extraction per slice, inside-out. After each slice, the 11 `Input.*.spec.tsx` files pass unedited and `conversation-input` lint is clean. Paths are under `libs/conversation-input/src/components/Input/`. Relative imports are extensionless. Branch: `refactor/split-conversation-input`.

Per-slice verification: `npm run test:file -- libs/conversation-input/src/components/Input/tests` and ESLint on `libs/conversation-input/src`, run from the lib directory.

## 1. Baseline

- [x] 1.1 Record the line count of `Input.tsx`, the `it` count of each `tests/Input.*.spec.tsx`, and the `CONVERSATION_INPUT_CLASS.` members used in `Input.tsx`.

## 2. Leaf hooks

- [x] 2.1 `hooks/useDismissibleTools.ts`: move the dismissed-ids state, the reset effect, `visibleTools` (with the phone rule) and `handleToolDismiss`. Parameters: `toolsMenuItems`, `canRemoveTools`, `isPhone`, `onToolToggle`.
- [x] 2.2 `hooks/useVoiceInput.ts`: move `handleAttachAudio`, `focusAfterTranscriptRef`, `latestTranscript`, `handleTranscript`, `useVoiceRecorder`, `isVoiceActive` and the focus-restore effect (design D1). Parameters: `addAttachments`, `buildAttachments`, `draftRef`, `setMessage`, `historyNav`, `onChange`, `onTranscribeAudio`, `voiceErrorLabel`, `textareaRef`, `skipFocusMenuEvaluationRef`.

  Until slice 3 creates the controller, `skipFocusMenuEvaluationRef` stays in `Input.tsx`.

## 3. Command menu

- [x] 3.1 `hooks/useCommandMenuController.ts`: move the following, then return what `Input` and the anchor hook read:
  - the `useCommandMenu` call;
  - the latest-handler and skip-focus refs;
  - `handleTextareaClick`, `handleTextareaFocus` and `handleTextareaKeyUp`;
  - the hint state (`hasCommandHintConfigured`, `triggerEnd`, `hasCommandEmptyQueryHint`) and `markerOffset`;
  - `handleCloseCommandMenu`;
  - the caret-revision restore effect, verbatim with its `eslint-disable` (design D2);
  - `handleCommandMenuKeyDown` with the `isSendGesture` it uses.

  Move `skipFocusMenuEvaluationRef` here and pass it to `useVoiceInput`.
- [x] 3.2 `hooks/useCommandMenuAnchor.tsx`: move, in this order:
  - the caret-marker and textarea-area refs;
  - `caretAnchor` and `measureCaretAnchor`;
  - the `ResizeObserver` effect;
  - `mirrorInsertions`, `isMirrorActive` and the `useMentionSelectionMirror` call;
  - the layout effect that measures after it;
  - `handleTextareaScroll` (design D2 and D3, spec requirement 2).

## 4. Send and keyboard

- [x] 4.1 `hooks/useSendKeyboard.ts`: move `hasSendableContent`/`canSend` if they are used only there, `handleSend` and `handleKeyDown`. If `Input` still renders `canSend` (the send button), keep it in `Input` and pass it in. The parameters are the values those functions read today.

## 5. Sections

- [x] 5.1 `InputCommandMenuArea.tsx`: move the `commandMenuArea` JSX verbatim (design D4).
- [x] 5.2 `InputTextareaArea.tsx`: move the `textareaArea` JSX verbatim. The `textarea` element stays built in `Input.tsx` and is passed in.

- [x] 5.3 Added during apply, after the planned slices left `Input.tsx` at 830 lines:
  - `hooks/usePasteHandling.ts`: paste-as-attachment, the long-paste warning and command-menu paste reporting;
  - `InputAttachButton.tsx`: the `+` button with the DIAL file-system menu item;
  - `input-css-vars.ts`: `buildInputCssVars`.

  `handleExpandPastedText` stays in `Input.tsx`.

## 6. Close

- [x] 6.1 Confirm the line counts: `Input.tsx` under 750 (record the actual number), and each new module under 300 with a JSDoc summary (`useCommandMenuController` is the recorded exception at 317). Confirm that `src/index.ts` and `README.md` are unchanged and that the `CONVERSATION_INPUT_CLASS.` members in `Input.tsx` match the baseline. Actual: `Input.tsx` 730; modules 33–170 lines, `useCommandMenuController` 317.
- [x] 6.2 Confirm that every `tests/Input.*.spec.tsx` file is unedited (`git diff --stat` empty for `tests/`) and that the `it` counts match the baseline.
- [x] 6.3 `npm exec nx run-many -- -t test lint build typecheck -p conversation-input --excludeTaskDependencies --parallel=1` passes, pinned to the worktree (design D5). `npm run validate:docs` and `npm run validate:specs` pass. Results in the worktree: test 29 files / 424 tests, build and typecheck pass; `lint` fails only on two `@nx/dependency-checks` errors in `package.json` that the clean `origin/development` baseline shows identically in this junctioned worktree, and ESLint over `src` is clean.
- [ ] 6.4 Check the command-popup anchor by hand in the running app (spec requirement 2): type enough lines to scroll the textarea, then type `/`. The popup must open at the trigger word.
- [ ] 6.5 Run `npm run verify:full` once.
