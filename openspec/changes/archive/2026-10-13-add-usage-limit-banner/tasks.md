Slicing strategy: **contract-first, then vertical.**
1. Land the config contract (env → DTO → generated client → `AppConfigContext`) and the lib slot. Both are small, independently testable, and unblock the UI.
2. Build the banner end to end in one composer, then widen it to the second.

## 1. Threshold config contract (chat-api → client)

- [x] 1.1 Add `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT?: number = 75` to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`, using `@IsOptional() @Transform(parseInt) @IsInt() @Min(1) @Max(99)` (modelled on `FILE_UPLOAD_MAX_BYTES`). Add cases to `apps/chat-api/src/config/tests/validation.spec.ts`:
  - it defaults to 75 when unset;
  - it parses `'90'`;
  - it rejects `'0'`, `'100'`, `'abc'`, and `'80.5'`.
  - Verification: `npm run test:file -- apps/chat-api/src/config/tests/validation.spec.ts`
- [x] 1.2 Add the `usageLimits.warningThresholdPercent` registry entry in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`: `type: 'config'`, `valueType: 'number'`, `visibility: 'client'`, `defaultValue: 75`, `envVar: 'USAGE_LIMITS_WARNING_THRESHOLD_PERCENT'`, `owner: 'chat-team'`. Add an entry test to `apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/config-registry/config-registry.constants.spec.ts`
- [x] 1.3 Add a required `usageLimitsWarningThresholdPercent!: number` with `@ApiProperty({ description, example: 75 })` to `ClientConfigResponseDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts`. Map it in `apps/chat-api/src/app-config/client-config.mapper.ts` with a `defineMapping` that falls back to 75 for a non-number, and add it to the mapper's defaults object. Extend `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` (resolved value; fallback) and the config key-order assertion in `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` and `npm run test:file -- apps/chat-api/src/app-config/tests/app-config.service.spec.ts`
- [x] 1.4 Regenerate the client: run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client` (`npm exec nx build chat-api-client`, `npm exec nx lint chat-api-client`). Do not hand-edit `libs/chat-api-client/src/generated/**`.
  - Verification: `openapi:check` reports no drift.
- [x] 1.5 Expose `config.usageLimitsWarningThresholdPercent` in `apps/chat/src/context/AppConfigContext.tsx`, with a `DEFAULT_USAGE_LIMITS_WARNING_THRESHOLD_PERCENT = 75` used before the config loads and when the response omits the field. Update `apps/chat/src/context/tests/app-config-context-mock.ts` only if its default shape needs the field.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/AppConfigContext.spec.tsx` (or the existing AppConfigContext spec)
- [x] 1.6 Document `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` in the env table of `apps/chat-api/README.md` and in `apps/chat-api/.env.template`: default 75, banner only, the dial keeps 75.
  - Verification: `npm run validate:docs`
- [x] 1.7 Slice check: `npm run verify:changed`

## 2. `aboveInputSlot` in `@epam/ai-dial-conversation-input`

- [x] 2.1 Add `aboveInputSlot?: ReactNode` with JSDoc to `ConversationInputProps` in `libs/conversation-input/src/models/ConversationInput.ts`. Destructure it in `libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx` (so it is not forwarded to `Input`) and render it inside the width container, directly above `<Input>`, wrapped only when `!= null`, using a block-axis gap (`mb-2`).
  - Verification: `npm run test:file -- libs/conversation-input/src/components/ConversationInput/ConversationInput.spec.tsx`
- [x] 2.2 Tests in `libs/conversation-input/src/components/ConversationInput/ConversationInput.spec.tsx`:
  - the slot content renders before the textarea;
  - an omitted or `null` slot adds no wrapper element.
  - Verification: as 2.1.
- [x] 2.3 Document `aboveInputSlot` in `libs/conversation-input/README.md`, in the props table and with a minimal example.
  - Verification: `npm run validate:docs`
- [x] 2.4 Architecture guard: confirm the slot change adds no usage DTO, threshold, feature flag, i18n, client import, or app context to `libs/conversation-input`. `git diff -- libs/conversation-input` should touch only the prop, its render, the tests, and the README.
- [x] 2.5 Slice check: `npm run verify:changed`

## 3. Pure helpers: source-row selection and reset wording

- [x] 3.1 Add the string enums `UsageBannerSeverity` (`Warning = 'warning'`, `Reached = 'reached'`) and `UsagePeriod` (`Day = 'day'`, `Week = 'week'`, `Month = 'month'`) in `apps/chat/src/types/usage-limits.ts`.
- [x] 3.2 Add to `apps/chat/src/utils/usage-limits.ts`:
  - an `isCappedStat(total)` predicate, which `findWorstCappedRow` also adopts;
  - `selectUsageBannerSource(dto, thresholdPercent)`, which returns `{ period, severity, usedPercent, resetsAt }` or `undefined` (six day/week/month token and cost stats; highest ratio; ties go to the longer period, then token over cost).
- [x] 3.3 Unit tests in `apps/chat/src/utils/tests/usage-limits.spec.ts`:
  - warning at 80/75;
  - below threshold;
  - threshold 90 with a row at 80%;
  - reached outranks warning;
  - a tie goes to the longer period;
  - unlimited and zero totals are ignored;
  - an undefined DTO;
  - `findWorstCappedRow` behaviour is unchanged.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/usage-limits.spec.ts`
- [x] 3.4 Add `formatUsageResetShort(resetsAt, period, locale, t)` to `apps/chat/src/utils/usage-reset-time.ts`:
  - day → a time with `shortOffset`;
  - week/month → a short date, with the year when it is not the current year;
  - it returns `{ isoValue, label, ariaLabel }` or `undefined` on any failure.
- [x] 3.5 Unit tests in `apps/chat/src/utils/tests/usage-reset-time.spec.ts`:
  - daily time in a fixed zone;
  - monthly date;
  - the cross-year date includes the year;
  - absent, unparseable, or throwing `Intl` input returns `undefined`.
  - Verification: `npm run test:file -- apps/chat/src/utils/tests/usage-reset-time.spec.ts`

## 4. Shared hooks: dismissal store and refresh-after-generation

- [x] 4.1 Create `apps/chat/src/hooks/useUsageLimitBannerDismissal.ts`: a module-scoped `Set<string>` plus listeners, read through `useSyncExternalStore`, returning `{ isDismissed, dismiss }`. Also export `resetUsageLimitBannerDismissals()` for tests. JSDoc explains why the store is module-scoped (it must survive the composer switch, not a reload).
- [x] 4.2 Unit tests in `apps/chat/src/hooks/tests/useUsageLimitBannerDismissal.spec.ts`:
  - a dismissed key reads as dismissed in a second hook instance;
  - another key does not;
  - the reset helper clears the store.
  - Verification: `npm run test:file -- apps/chat/src/hooks/tests/useUsageLimitBannerDismissal.spec.ts`
- [x] 4.3 Move the generation-end refresh effect verbatim from `apps/chat/src/components/UsageLimitsControl/UsageLimitsControl.tsx` into `apps/chat/src/hooks/useRefreshUsageAfterGeneration.ts`, and call it from `UsageLimitsControl`.
- [x] 4.4 Unit tests in `apps/chat/src/hooks/tests/useRefreshUsageAfterGeneration.spec.ts`:
  - `true → false` triggers one refresh;
  - a refresh is deferred while `isLoading`;
  - no refresh happens without a transition.
  - Then confirm the existing refresh cases still pass.
  - Verification: `npm run test:file -- apps/chat/src/hooks/tests/useRefreshUsageAfterGeneration.spec.ts` and `npm run test:file -- apps/chat/src/components/UsageLimitsControl/tests/UsageLimitsControl.spec.tsx`

## 5. i18n keys

- [x] 5.1 Add the `ConversationInputUsageBannerI18nKeys` enum to `apps/chat/src/constants/translation-keys.ts`, with `WarningDay`, `WarningWeek`, `WarningMonth`, `ReachedDay`, `ReachedWeek`, `ReachedMonth`, `ResetsAtTime`, and `ResetsOnDate`, all under `conversationInput.usageBanner.*`. Add the matching English strings to `apps/chat/src/i18n/locales/en.json`, exactly as listed in the spec, and check that no identical existing value should be reused instead.
  - Verification: `npm run test:file -- apps/chat/src/i18n/tests` (locale key-parity spec, if present), and `npm run validate:specs`

## 6. `UsageLimitBanner` component (vertical slice: new-chat composer)

- [x] 6.1 Create `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx` (`Props`: `deploymentId`, `isGenerationInProgress?`). It:
  - calls `useDeploymentUsageLimits`, `useRefreshUsageAfterGeneration`, and `useUsageLimitBannerDismissal`;
  - reads the threshold from `useAppConfig()`;
  - memoises the source row and formatted strings;
  - renders the kit `Notification` (`type={NotificationType.SectionMessage}`, `closable`, `role="status"`, a Warning or Error variant) with a semibold period sentence and a `<time dateTime>` reset sentence;
  - renders nothing in the empty, loading, error-without-data, below-threshold, and dismissed states;
  - exports `memo(UsageLimitBanner)`;
  - passes `iconStroke={DIAL_KIT_ICON_STROKE}`, because the kit default is 2.
- [x] 6.2 Component tests in `apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx`, using role and text queries (`getByRole('status')`, `getByText`, and the close button by role):
  - warning wording;
  - reached wording and variant;
  - hidden below the threshold and with a custom threshold;
  - hidden while loading or without a deployment;
  - the last value is kept on a refresh failure;
  - after Close, it stays hidden as usage creeps up and reappears on escalation or on a deployment switch;
  - refresh after generation;
  - the reset sentence is omitted when `resetsAt` is absent.
  - Verification: `npm run test:file -- apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx`
- [x] 6.3 Wire `apps/chat/src/components/NewConversationComposer/NewConversationComposer.tsx`: with `isUsageLimitsControlEnabled`, pass `usageLimitsSlot={<UsageLimitsControl …/>}` and `aboveInputSlot={undefined}`; otherwise pass `aboveInputSlot={<UsageLimitBanner deploymentId=… />}` and `usageLimitsSlot={undefined}`. Update `apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`: capture `aboveInputSlot` in the `ConversationInput` mock, mock `UsageLimitBanner`, and assert that the banner and not the dial shows by default, and the dial and not the banner shows with the flag on.
  - Verification: `npm run test:file -- apps/chat/src/components/NewConversationComposer/tests/NewConversationComposer.spec.tsx`
- [x] 6.4 Slice check: `npm run verify:changed`

## 7. Widen to the conversation composer

- [x] 7.1 Apply the same XOR wiring in `apps/chat/src/components/ConversationView/ConversationView.tsx`, passing `isGenerationInProgress={isAssistantTyping}` to the banner. Mock `UsageLimitBanner` (`default: () => null`) in `apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx` and `apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx`, next to the existing `UsageLimitsControl` mock.
  - Verification: `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.reply.spec.tsx` and `npm run test:file -- apps/chat/src/components/ConversationView/tests/ConversationView.message-memo.spec.tsx`
- [x] 7.2 If an `AppPreviewChat` composer path reaches `ConversationView` or `NewConversationComposer`, confirm that `apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx` still passes.
  - Verification: `npm run test:file -- apps/chat/src/pages/ApplicationEditor/setup/tests/AppPreviewChat.spec.tsx`

## 8. RTL and responsive check

- [x] 8.1 RTL: confirm the slot wrapper and banner content use only logical or block-axis utilities (no `ml-`/`mr-`/`pl-`/`pr-`/`left-`/`right-`/`text-left`/`text-right`). The warning and error icons are symmetric and must not be mirrored. Add an RTL case to `UsageLimitBanner.spec.tsx` that renders under `dir="rtl"` and asserts the content order and roles are unchanged.
  - Verification: `npm run test:file -- apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx`
- [x] 8.2 Mobile: check that the banner wraps inside the composer width at mobile widths with no horizontal overflow, using only the `mobile:`/`desktop:` breakpoints if any are needed. Assert in the component spec that no fixed width is set.

## 9. Docs and specs

- [x] 9.1 Update the "Token-usage limits control" section of `docs/technical-requirements.md`: by default (flag off), the banner above the input replaces the dial, with its threshold env var and dismissal rule.
  - Verification: `npm run validate:docs`
- [x] 9.2 Run `npm run validate:specs` and `npm run spec:impact`, and resolve any reference the change introduces.

## 10. Close-out

- [x] 10.1 Run `npm run verify:full` once.
- [ ] 10.2 Follow-up, out of scope: open a `@epam/ai-dial-ui-kit` issue asking for a `closeAriaLabel` prop on `Notification`, so the banner's close button can be translated (`ButtonsI18nKeys.Close`). Record the issue link in the PR description.
