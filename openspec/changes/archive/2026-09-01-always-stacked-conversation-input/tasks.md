## 1. Remove the multi-line measurement

- [x] 1.1 In `libs/conversation-input/src/hooks/useMessageState.ts`, delete `isMultiLine` state, `singleRowHeightRef`, the mount-time `offsetHeight` effect, and the `useLayoutEffect` height comparison (with its oscillation-guard comment). Keep the `messageProp`/`messageRevision` resync effect untouched.
- [x] 1.2 Drop `isMultiLine` from the `UseMessageStateResult` interface and its JSDoc, and from the hook's return value. Remove the now-unused `useLayoutEffect` import.
- [x] 1.3 Verify: `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.spec.tsx`

## 2. Make the Input layout unconditional

- [x] 2.1 In `libs/conversation-input/src/components/Input/Input.tsx`, remove the `isStacked` prop from the destructured props and delete the `isStackedLayout` computation. Stop destructuring `isMultiLine` from `useMessageState`.
- [x] 2.2 Replace the `hideActionBar` branch `isStackedLayout && textarea` with `textarea` so the textarea always renders inside the bordered box.
- [x] 2.3 Reorder the action-bar JSX to match the visual order — textarea container, `+` button, tools chips, trailing actions — and delete every `order-*` class (`order-1`…`order-4`, `desktop:order-1`, `desktop:order-2`). Confirm the resulting DOM/tab order is textarea → `+` → chips → model selector → send/stop → mic.
- [x] 2.4 Delete the remaining layout-conditional classes: `desktop:flex-nowrap` on the action row (keep `flex-wrap`), `desktop:w-auto desktop:flex-1` on the textarea container (it is now always full width), and `desktop:ms-0` on the trailing action group (keep `ms-auto`).
- [x] 2.5 Keep the chips row's `min-w-0 flex-1` and render it whenever `visibleTools.length > 0 && onToolToggle != null`; `hasTools` no longer gates any layout decision.
- [x] 2.6 Remove `min-h-[64px]` from the wrapper's class list so the box is sized by its content.
- [x] 2.7 Leave the wrapper's padding rules, attachment tray, voice-bar early return, and send-button exit animation unchanged.
- [x] 2.8 Verify: `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.spec.tsx` and `npm run test:file -- libs/conversation-input/src/components/Input/tests/Input.tools.spec.tsx`

## 3. Remove the prop from the public API and its callers

- [x] 3.1 Delete the `isStacked?: boolean` field and its JSDoc block from `InputProps` in `libs/conversation-input/src/models/Input.ts`.
- [x] 3.2 Remove the `isStacked` prop from the `<Input>` call in `libs/conversation-input/src/components/EditMessageInput/EditMessageInput.tsx` (keep `hideActionBar` and `hideAddButton` behaviour as is).
- [x] 3.3 Grep the workspace for any remaining `isStacked` / `isMultiLine` reference in `apps/**` and `libs/**` source (ignore `dist/`) and remove it.
- [x] 3.4 Verify: `npm run test:file -- libs/conversation-input/src/components/EditMessageInput/tests/EditMessageInput.spec.tsx`

## 4. Tests

- [x] 4.1 Add an `Input` test asserting the always-stacked structure for an empty input with no tools and no attachments: the textarea is not a sibling inside the same row container as the `+` button / model selector group. Query by role and structure, not by Tailwind class strings.
- [x] 4.2 Add a test that the layout is identical before and after typing a message containing a newline (no reflow, controls unchanged).
- [x] 4.3 Add a test that `hideActionBar` renders the textarea with an empty message and renders no action-bar controls.
- [x] 4.4 Add a test that the tools chips row renders between the textarea and the trailing actions when tools are supplied.
- [x] 4.5 Fix or rewrite any existing assertion in `libs/conversation-input/src/components/**/tests/**` that encodes the removed inline layout; rewrite rather than patch to pass.
- [x] 4.6 Verify: `npm run test:file -- <each touched spec>`

## 5. Docs and verification

- [x] 5.1 Update `libs/conversation-input/README.md` if it documents `isStacked` or describes the input as a single-row control; describe the two-row layout instead.
- [x] 5.2 Run `npm run validate:docs`.
- [x] 5.3 Run `npm run verify:changed`, then `npm run verify:full` once before completion.
- [ ] 5.4 (left for the user — no chat-api .env locally, chat view is auth-gated) Manually check the chat view at a mobile and a desktop viewport: collapsed input is two rows, growing text does not reflow the controls, attachments render above the textarea, tools chips wrap inside their own row, and nothing positioned against the input's height (scroll-to-bottom control, drag-and-drop overlay) overlaps it.
