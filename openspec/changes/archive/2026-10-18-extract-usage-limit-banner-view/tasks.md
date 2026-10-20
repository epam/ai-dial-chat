Slicing strategy: **vertical, lib first.**
1. Land the lib view with its own tests and docs. It is independently verifiable, and no app code uses it yet.
2. Switch the app container to the view and remove the app enum, proving the end-to-end path through both composers is unchanged.

## 0. Prerequisite

- [x] 0.1 Confirm `add-usage-limit-banner` is archived: `openspec/specs/conversation-input-usage-limit-banner/spec.md` exists and contains "Banner rendering and wording". If it is not archived yet, stop and archive it first (its task 10.2 is resolved or explicitly deferred). Without it, this change's MODIFIED delta has no base.
  - Verification: `openspec validate extract-usage-limit-banner-view`

## 1. Lib: `UsageLimitBannerView` in `@epam/ai-dial-conversation-input`

- [x] 1.1 Create `libs/conversation-input/src/models/UsageLimitBanner.ts` with:
  - the string enum `UsageLimitBannerSeverity` (`Warning = 'warning'`, `Reached = 'reached'`);
  - the interfaces `UsageLimitBannerReset` (`isoValue`, `label`, `ariaLabel?`) and `UsageLimitBannerViewProps` (`severity`, `limitText`, `reset?`, `onClose?`, `limitTextClassName?`, `resetTextClassName?`, `className?`);
  - JSDoc on every symbol and property, quoting defaults verbatim.
  - Verification: `npm exec nx run @epam/ai-dial-conversation-input:typecheck`
- [x] 1.2 Add `usageBanner: 'dial-ci-usage-banner'` with JSDoc to `CONVERSATION_INPUT_CLASS` in `libs/conversation-input/src/constants/public-class-names.ts`.
  - Verification: as 1.1.
- [x] 1.3 Create `libs/conversation-input/src/components/UsageLimitBannerView/UsageLimitBannerView.tsx` as `export const UsageLimitBannerView: FC<UsageLimitBannerViewProps>` with a one-line JSDoc. It renders the kit `Notification`:
  - `type={NotificationType.SectionMessage}`, Warning→`NotificationVariant.Warning` and Reached→`NotificationVariant.Error` (as a `switch` or a lookup map, no nested ternary);
  - `role="status"`, `iconStroke={DIAL_KIT_ICON_STROKE}`, and `closable={onClose != null}` with `onClose`;
  - `className={mergeClasses(CONVERSATION_INPUT_CLASS.usageBanner, className)}`;
  - a message of `limitText` in a `<span>` with `limitTextClassName` (default `'dial-body-semi-text'`, verified with the ui-kit MCP `getEntityDetails("typography")`), then, when `reset` is present, a space, `<time dateTime={reset.isoValue} aria-hidden={reset.ariaLabel != null || undefined} className={resetTextClassName}>`, and an `sr-only` sibling for `reset.ariaLabel`.
  - Use extensionless relative imports.
  - Verification: as 1.1.
- [x] 1.4 Export `UsageLimitBannerView`, `UsageLimitBannerSeverity`, and the types `UsageLimitBannerViewProps` and `UsageLimitBannerReset` from `libs/conversation-input/src/index.ts`.
  - Verification: as 1.1.
- [x] 1.5 Unit tests in `libs/conversation-input/src/components/UsageLimitBannerView/tests/UsageLimitBannerView.spec.tsx`, using role/text queries and a spy wrapping the real `Notification` (include `DIAL_KIT_ICON_STROKE` from the actual module):
  - it maps Warning and Reached to the warning and error variants as a closable section message;
  - it renders with `role="status"` and never `role="alert"`;
  - it renders the limit sentence then the reset sentence in a `<time>` with the given `dateTime`;
  - it hides the `<time>` and renders the spoken form in an `sr-only` sibling when `ariaLabel` is given, and leaves the `<time>` exposed without it;
  - it omits the reset sentence when `reset` is absent;
  - it calls `onClose` from a click and from Tab + Enter;
  - it renders no close button without `onClose`;
  - it carries `dial-ci-usage-banner` plus the host `className`;
  - it applies a custom `limitTextClassName`;
  - it sets no fixed width;
  - it renders host text verbatim;
  - under `dir="rtl"` the content order and roles are unchanged.
  - Verification: `npm run test:file -- libs/conversation-input/src/components/UsageLimitBannerView/tests/UsageLimitBannerView.spec.tsx`
- [x] 1.6 RTL: confirm the view adds no physical-direction utilities (`ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`) and no icon mirroring; the kit's warning and error icons are symmetric. Covered by the RTL case in 1.5.
- [x] 1.7 Document the view in `libs/conversation-input/README.md`:
  - a `### UsageLimitBannerView` subsection under Components, with a compiling example that passes the required `severity` and `limitText` plus `reset` and `onClose`, and a note that the host supplies translated text and that the close button's name is the kit's;
  - a `UsageLimitBannerSeverity` entry under Enums;
  - a `dial-ci-usage-banner` row in the public class-name table;
  - the existing `aboveInputSlot` paragraph pointing to it.
  - Verification: `npm run validate:docs`
- [x] 1.8 Architecture guard:
  - `git diff -- libs/conversation-input` adds no `react-i18next`, `@epam/ai-dial-chat-api-client`, `Intl`, app context, feature flag, env, storage, or routing reference;
  - `git diff -- libs/conversation-input/package.json` is empty;
  - the `UsageLimitBannerView` source declares no `closeAriaLabel` or other unread prop.
- [x] 1.9 Slice check: `npm run verify:changed`

## 2. App: compose the lib view

- [x] 2.1 Delete `UsageBannerSeverity` from `apps/chat/src/types/usage-limits.ts`, keeping `UsagePeriod`. Switch `apps/chat/src/utils/usage-limits.ts` (`UsageBannerSource.severity`, `selectUsageBannerSource`) and `apps/chat/src/utils/tests/usage-limits.spec.ts` to `UsageLimitBannerSeverity` from `@epam/ai-dial-conversation-input`. Grep confirms no `UsageBannerSeverity` reference remains under `apps/`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/usage-limits.spec.ts`
- [x] 2.2 In `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`, replace the inline `Notification` with `<UsageLimitBannerView severity={source.severity} limitText={display.periodSentence} reset={display.reset} onClose={handleClose} />`. Remove the now-unused kit imports and the inline `role`/`<time>` markup. All hooks, memoisation, the dismissal key, and the props stay the same.
  - Verification: `npm run test:file -- apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx`
- [x] 2.3 Update `apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx`:
  - replace the `@epam/ai-dial-ui-kit` `Notification` spy with a partial mock of `@epam/ai-dial-conversation-input` wrapping the real `UsageLimitBannerView`;
  - assert it receives `severity` (`UsageLimitBannerSeverity.Reached` / `Warning`), `limitText`, and an `onClose`;
  - leave every other case unchanged.
  - Verification: as 2.2.
- [x] 2.4 Confirm both composers are unaffected.
  - Verification: `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`, `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx`, `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx`
- [x] 2.5 Bundling check (design risk "Lazy chunk"): run `npm run build:quiet` and confirm the build succeeds with no new or materially larger eager chunk from `@epam/ai-dial-conversation-input`.
- [x] 2.6 Slice check: `npm run verify:changed`

## 3. Docs, specs, close-out

- [x] 3.1 In the "Token-usage limits control" section of `docs/technical-requirements.md`, state that the app banner composes `UsageLimitBannerView` from `@epam/ai-dial-conversation-input`, and that the lib view is presentational while data, threshold, wording, and dismissal stay in the app.
  - Verification: `npm run validate:docs`
- [x] 3.2 Run `openspec validate extract-usage-limit-banner-view`, `npm run validate:specs`, and `npm run spec:impact`, and resolve any reference the change introduces.
- [ ] 3.3 Run `npm run verify:full` once.
- [ ] 3.4 Follow-up, out of scope: once `@epam/ai-dial-ui-kit` ships a close-label prop on `Notification` (`add-usage-limit-banner` task 10.2), add `closeAriaLabel` with an English default to `UsageLimitBannerViewProps` and pass `t(ButtonsI18nKeys.Close)` from the app.
