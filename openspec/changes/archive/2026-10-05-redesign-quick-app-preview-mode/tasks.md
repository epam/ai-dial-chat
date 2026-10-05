# Tasks: redesign-quick-app-preview-mode

**Slicing strategy:** risk-first, then vertical.

- Slice 1 proves the riskiest part: moving the preview out of the Setup column while keeping the iframe and the chat session alive. It ships with the old chat UI unchanged.
- Slices 2 to 4 add the new visible pieces (page chrome, greeting, copy) on top.
- Each slice ends green on its own.

All paths are relative to `apps/chat/src/`. No `libs/*` changes. If one ever looks necessary, stop and revisit design D1/D2.

## 1. Move the preview surface to page level (no visual redesign yet)

- [x] 1.1 In `models/application-editor.ts`:
  - add the exported `ApplicationPreviewProps` interface (D2), JSDoc on each field;
  - add `Preview?: ComponentType<ApplicationPreviewProps>` to `ApplicationEditorDefinition`;
  - add `onPreviewReset: () => void` to `ApplicationSetupProps`;
  - remove `isPreviewing` from `ApplicationSetupProps`;
  - remove `exitPreview` from the message keys type.
- [x] 1.2 In `pages/ApplicationEditor/setup/QuickAppSetup.tsx`:
  - remove `AppPreviewChat`, its wrapper and `previewResetKey` state;
  - render `AppEditorIframe` without the `isPreviewing && 'hidden'` toggle;
  - call `onPreviewReset()` at the two places that bumped the key, keeping the order in `startPreview` (reset before awaiting `refetchDeployments()`).
- [x] 1.3 Create `pages/ApplicationEditor/setup/QuickAppPreview.tsx`:
  - an `FC<Props>` with `Props = ApplicationPreviewProps`;
  - resolve the schema from `useDeployments().schemas` plus `AppsEditorQuery.Schema`, as `QuickAppSetup` does;
  - render `AppPreviewChat` with `appId`, `appDisplayName = metadata.name || schema?.displayName`, `appIconUrl = metadata.iconUrl || schema?.iconUrl`;
  - temporary Back button (final chrome comes in 2.x);
  - `export default memo(QuickAppPreview)`.
- [x] 1.4 In `pages/ApplicationEditor/definitions/quickAppDefinition.tsx`, set `Preview: QuickAppPreview` and drop `exitPreview: AppsEditorI18nKeys.ExitPreviewButton`.
- [x] 1.5 In `pages/ApplicationEditor/ApplicationFormEditor.tsx`:
  - own `previewResetKey` and add a `handlePreviewReset` `useCallback`;
  - wrap `EntityEditor` with `hidden`/`inert` while previewing (D1) and drop `hideStandardActions`;
  - render `definition.Preview` (only when `isEditMode`) in a sibling wrapper, hidden or `inert` when not previewing, with `key={previewResetKey}` (D2);
  - make the header button enter-only: always `basic.preview` + `IconEye`, no `aria-pressed`, no `IconEyeOff`; gate it on `isEditMode && definition.Preview && messageKeys.preview`;
  - add `handleExitPreview` (`useCallback`) and pass `onPreviewReset` to `Setup`.
- [x] 1.6 Update tests for the moved ownership:
  - `pages/ApplicationEditor/setup/tests/QuickAppSetup.spec.tsx`: the Setup renders no preview region; `onPreviewReset` is called once on `hasChanges: true` and not on `false`, for both `save` and `startPreview`; the `startPreview` reset happens before the refetch resolves.
  - `pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`: replace the Exit-preview / `aria-pressed` assertions (around line 370) with: entering preview hides the editor (title, Save and Cancel not visible); Back returns to the editor; the iframe element is the same node before and after; a sent preview message survives leaving and re-entering preview.

  **Verification:**
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/QuickAppSetup.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`
  - then `npm run verify:changed` once for the slice.

## 2. Preview page chrome: header, banner, focus

- [x] 2.1 Add the i18n strings (dedicated task):
  - in `constants/translation-keys.ts` under `AppsEditorI18nKeys`, add `PreviewBackToSetup`, `PreviewBannerLabel`, `PreviewBannerText` and `PreviewGreeting`, and remove `ExitPreviewButton`;
  - in `i18n/locales/en.json`, add the matching `appsEditor.previewChat.*` values from the spec table, change `appsEditor.previewChat.placeholder` to "Send a test message", and delete `appsEditor.exitPreviewButton`;
  - first grep `en.json` for "Back to setup" and "Preview mode" and reuse an existing `ButtonsI18nKeys` / `BasicI18nKeys` entry if the exact value exists.
- [x] 2.2 In `QuickAppPreview.tsx`, add the header row (D7):
  - a `GhostButton` with the `PreviewBackToSetup` label and leading `IconArrowNarrowLeft` (`size={DIAL_ICON_SIZE.SM}`, `stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`, `className="rtl:scale-x-[-1]"`) that calls `onExit`;
  - a visually hidden `<h1>` with the `PreviewBannerLabel` text.
  Look up the 2.0 `GhostButton` props (and whether it forwards a ref) with the ui-kit MCP `getEntityDetails` first.
- [x] 2.3 In `QuickAppPreview.tsx`, add the banner (D6):
  - label with `dial-tiny-lead-semi-text`;
  - text via `Trans` with `PreviewBannerText`, `values={{ name }}` and `components={{ bold: <strong /> }}`;
  - theme-token background and border chosen via ui-kit MCP (`searchEntity("token", "accent")`), logical spacing only.
- [x] 2.4 Add focus management (D5):
  - `QuickAppPreview` focuses Back to setup when `isVisible` becomes `true`;
  - `ApplicationFormEditor` focuses the Preview button in an effect when `isPreviewing` goes from `true` to `false`.
- [x] 2.5 Add tests in `pages/ApplicationEditor/setup/tests/QuickAppPreview.spec.tsx` (new), using role and text queries only, no `data-testid`:
  - the Back button calls `onExit`;
  - the banner shows the app name in a `strong`, falling back to the schema `displayName` when `metadata.name` is empty;
  - the page has an `h1`;
  - Back is focused when `isVisible` flips to `true`.

  In `quickAppDefinition.spec.tsx`, add: after entering preview, focus is on "Back to setup"; after Back, focus is on "Preview".

  **Verification:**
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/QuickAppPreview.spec.tsx`
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/tests/quickAppDefinition.spec.tsx`
  - then `npm run verify:changed`.

## 3. Greeting bubble and new placeholder

- [x] 3.1 Check the `AssistantMessageBubble` contract in `libs/conversation-messages/src/models/message-bubble.ts` (required props, and whether actions render when no callbacks are passed). Record the outcome in a short comment in the code if the fallback in D4 is needed.
- [x] 3.2 In `pages/ApplicationEditor/setup/AppPreviewChat.tsx`:
  - build a `useMemo` greeting node from `AppsEditorI18nKeys.PreviewGreeting`, `appIconUrl` and `appDisplayName` (D4);
  - render it above `NewConversationComposer` in a `mx-auto w-full max-w-[760px] px-6 pt-7` wrapper in the pre-conversation branch;
  - pass it as `topContent` to `ConversationView` in the conversation branch.
- [x] 3.3 Extend `pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`:
  - the greeting text and app avatar render before the first message, while starters and intro text still render;
  - after sending, the greeting is still present and precedes the user message;
  - the `apiCreateConversation` / `startStream` payload doesn't contain the greeting text;
  - the composer placeholder is "Send a test message";
  - with no icon URL, the avatar shows the initials.

  **Verification:**
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`
  - then `npm run verify:changed`.

## 4. RTL, mobile and a11y pass

- [x] 4.1 RTL (dedicated task):
  - confirm every new class in `QuickAppPreview.tsx` and the greeting wrapper is logical (`ps/pe`, `ms/me`, `start/end`, `text-start`);
  - only the back arrow carries `rtl:scale-x-[-1]` and `IconEye` is not flipped;
  - add an RTL test in `QuickAppPreview.spec.tsx` that renders under `dir="rtl"` and asserts the arrow icon has the mirror class.
- [x] 4.2 Mobile parity (follow the `responsive-design` skill):
  - the header and banner wrap, and the chat area scrolls on its own;
  - the hidden `EntityEditor` takes `EditorLayout`'s mobile bottom action bar with it, so no Cancel/Save bar shows in preview;
  - use only the `mobile`/`desktop` breakpoints.
- [x] 4.3 Check the preview surface against `.claude/rules/a11y.md`:
  - icons `aria-hidden`;
  - no `aria-hidden` on focusable subtrees (hidden wrappers use `inert`);
  - the banner text meets AAA contrast with the chosen tokens;
  - region and `role="log"` are unchanged.

  **Verification:**
  - `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/QuickAppPreview.spec.tsx`
  - then `npm run verify:changed`.

## 5. Docs and close-out

- [x] 5.1 Use the `dial-docs` skill to check whether `docs/` describes the Quick App preview (for example `docs/product-requirements.md`). Update any described behaviour (Exit preview toggle, preview inside the Setup column) in this same change. `docs/architecture.md` needs no update (no new context, route, lib or app).
- [x] 5.2 Fix the stray leading `с` character on line 1 of `openspec/specs/app-preview-chat/spec.md` when syncing specs (out-of-scope typo found during planning; it is fixed only as part of the spec sync).
- [ ] 5.3 Run `npm run verify:full` once to close the change.
- [ ] 5.4 Follow-up (not in this change): confirm the banner copy "Usage is following your limits." with product/design (suggested: "Usage counts toward your limits.") and whether the greeting should carry actions.
