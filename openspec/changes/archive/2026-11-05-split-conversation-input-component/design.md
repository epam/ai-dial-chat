## Context

`Input.tsx` is one `forwardRef` render function of 1423 lines:

| Lines | Content |
| --- | --- |
| 69–163 | props destructure |
| 164–525 | state, focus, command-menu wiring and caret anchoring |
| 526–725 | attachments, voice, paste and tool chips |
| 727–951 | send and keyboard, mirror insertions |
| 953–1423 | JSX |

It is a lib component. `.claude/rules/libs.md` and the lib-isolation rules apply: no host knowledge, colors through `*Colors` CSS variables, strings through `*Labels` props. This change moves code only and does not touch any of those surfaces.

`components/Input/tests/` holds 11 `Input.*.spec.tsx` files (about 4,000 lines), organized by concern:

- classes, command menu, initial caret, layout and mentions;
- recording, send tooltip and tools;
- voice focus, voice and core.

They render `Input` and assert DOM and callbacks, so they verify the split without edits.

Three main specs cite `components/Input/Input.tsx`:

- `lib-public-class-names`, for the `dial-ci-*` classes;
- `conversation-draft-persistence`, for `handleExpandPastedText`;
- `url-entity-preselection`, for the initial-caret effect.

Everything they cite stays in `Input.tsx`.

## Goals / Non-Goals

**Goals:**

- One concern per module, with hook boundaries that make data flow explicit through parameters and return values.
- `Input.tsx` under 750 lines, and every new module under 300.
- Identical behavior, DOM and effect timing.

**Non-Goals:**

- Changing the API or DOM.
- New tests.
- Moving the public-class markup.
- Other frontend plan items.

## Decisions

### D1 — Five hooks and two sections, private to `components/Input/`

The hooks go in `components/Input/hooks/` rather than the lib-level `src/hooks/`. They are implementation details of one component, while `src/hooks/` holds reusable hooks such as `useCommandMenu`, `useAttachments` and `useVoiceRecorder`. The sections sit beside `Input.tsx`, next to `ModelSelectorControl.tsx`.

Hook inputs are named parameter objects, and outputs are named objects, following `useAttachments`. Data does not cross a hook boundary through refs, except `skipFocusMenuEvaluationRef` and `draftRef`:

- `skipFocusMenuEvaluationRef` is created in `useCommandMenuController` and written by `useVoiceInput`'s focus-restore effect, as it is today. It is returned from the controller and passed into `useVoiceInput`.
- `draftRef` is created in `Input.tsx`, next to `handleExpandPastedText`, and passed into `useVoiceInput`.

A ref that becomes a hook parameter is added to the dependency arrays that read it, because `react-hooks/exhaustive-deps` cannot see it is a ref. A ref object is stable across renders, so this changes no behavior.

### D2 — Call order preserves effect order where it matters

React runs effects in declaration order, and a custom hook's effects run at its call site. The relevant orderings are:

1. The `useMentionSelectionMirror` layout effect comes before the `measureCaretAnchor` layout effect. Both live in `useCommandMenuAnchor`, in that order (spec requirement 2).
2. The caret-revision restore effect, which places the caret and re-evaluates the menu, keeps its `[message]` dependency and its `eslint-disable` for exhaustive-deps, moved verbatim into `useCommandMenuController`. It is called after `useTextInsertion`, because it uses `markCaretPlaced`.
3. The passive effects of voice focus restore, the tool-list reset and the anchor `ResizeObserver` are independent of one another. Their relative order may shift without observable effect.

`Input` calls the hooks in this order:

- `useMessageState`, then the focus effects;
- `useTextInsertion`, then `useCommandMenuController`;
- `handleExpandPastedText`, then `useAttachments`, then `useVoiceInput`;
- paste;
- `useDismissibleTools`, then `useSendKeyboard`;
- `useCommandMenuAnchor`.

### D3 — `useCommandMenuAnchor` is a `.tsx` hook

`mirrorInsertions` creates the zero-size caret-marker `<span>` and the empty-query hint `<span>`, the latter with `styles.commandHint`. They stay in the hook that owns the marker ref, because separating the node from its ref invites a mismatch. The hook imports `Input.module.scss` for `commandHint`. No new stylesheet is created.

### D4 — Sections are presentational

`InputCommandMenuArea` receives the following through props:

- the textarea node and `textareaRef` (the `Dropdown`'s outside-press ignore target);
- the `commandMenu` config and the font class;
- `isMenuOpen`, `caretAnchor`, `query`, `activeWordStart`, `overlayRef`, `listboxId`, `activeOptionId`;
- `onOutsidePress` (`closeOnOutsidePress`) and `onClose` (`handleCloseCommandMenu`).

`InputTextareaArea` receives:

- the textarea node, built in `Input.tsx`, where its `onChange`, `onKeyDown` and `onPaste` wiring lives next to the state it touches;
- `mirrorRef`, `selectionRects`, `mirrorInsertions`, `mentionRanges`;
- `isMirrorActive`, `textareaAreaRef`;
- the `commandMenuArea` node.

Neither section reads context or holds state. Their markup, classes and ARIA are moved verbatim.

### D5 — Verification is the existing behavior suite

Each extraction is a slice. After every slice the 11 `Input.*.spec.tsx` files and the lib's ESLint run, and the `it` counts are compared with the baseline at the end. The worktree's junctioned `node_modules` resolves plain `nx` to the main checkout, so targets run with `NX_WORKSPACE_ROOT_PATH` pinned to the worktree (as in `split-conversation-controller`).

## Risks / Trade-offs

- **[A stale closure from moving a callback across a hook boundary]** → Callbacks move with their dependency arrays unchanged, and values that were read from component scope become hook parameters of the same name. The `react-hooks/exhaustive-deps` lint runs on every slice.
- **[Effect order changes timing]** → D2 pins the two orderings that matter. The command-menu, mentions, initial-caret and voice-focus specs cover them.
- **[The size target is missed]** → If `Input.tsx` lands between 750 and 800 lines because of the props destructure and the root JSX, the number is recorded honestly in the tasks, as in earlier changes, rather than moving public markup.
- **[Hook-to-hook ref coupling]** → It is limited to the two refs in D1 and named in each hook's JSDoc.
