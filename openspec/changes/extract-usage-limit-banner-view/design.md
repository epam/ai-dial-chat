## Context

- **Where the code is today.** `add-usage-limit-banner` built `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`, which mixes two kinds of code:
  - **Host logic:** `useDeploymentUsageLimits`, `useAppConfig()` for the threshold, `selectUsageBannerSource`, `formatUsageResetShort`, `t()`, `useUsageLimitBannerDismissal`, `useRefreshUsageAfterGeneration`.
  - **Presentation:** the kit `Notification` (`SectionMessage`, Warning/Error variant, `role="status"`, `closable`, `iconStroke={DIAL_KIT_ICON_STROKE}`), a semibold `<span>`, and an `aria-hidden` `<time>` with an `sr-only` sibling.
- **The slot is already in the lib.** The banner reaches the composer through `aboveInputSlot` on `ConversationInput` (`libs/conversation-input/src/components/ConversationInput/ConversationInput.tsx`).
- **Reference patterns:**
  - The `<time>` + `sr-only` reset pattern is from `ModelLimitsSection` (`libs/usage-dashboard/src/components/ModelLimitsSection/ModelLimitsSection.tsx`).
  - Public classes live in `libs/conversation-input/src/constants/public-class-names.ts`, with a README table checked by `npm run validate:docs`.
  - Lib enums live in `models/`, e.g. `SendOnEnter` in `libs/conversation-input/src/models/Input.ts`.
  - Component specs go in a `tests/` subfolder, e.g. `libs/conversation-input/src/components/BottomSheetShell/tests/BottomSheetShell.spec.tsx`.
- **What the lib already depends on.** `@epam/ai-dial-ui-kit` (peer `^0.15.3`) and `@epam/ai-dial-chat-shared` (`mergeClasses`). Nothing new is needed.

## Goals / Non-Goals

**Goals:**
- One host-agnostic, documented banner view that any `conversation-input` host can drop into `aboveInputSlot`.
- No behaviour or DOM change for `apps/chat` users.
- One severity enum shared by the lib and the app.

**Non-Goals:**
- Moving data, policy, formatting, i18n, or dismissal into a lib (see proposal).
- A translatable close-button name (kit gap).
- Colour or typography theming beyond class props: the kit's Notification tokens already own the colours.

## Decisions

### 1. Owner: `libs/conversation-input`

The view sits next to the slot it is designed for, and adds no dependency to a host that already installs `@epam/ai-dial-conversation-input`.

*Alternatives:*
- `@epam/ai-dial-usage-dashboard`. Rejected: it would create a cross-lib dependency, or a second install for the host.
- A new `libs/usage-banner`. Rejected: a whole package (manifest, README, install matrix, `docs/architecture.md`) for one component.

### 2. Name: `UsageLimitBannerView`, app container unchanged

The `View` suffix marks the presentational half and avoids colliding with the app's `UsageLimitBanner` container. Keeping the app component's name and path means the `add-usage-limit-banner` specs and tests that cite `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx` stay valid.

*Alternative:* name the lib component `UsageLimitBanner` and rename the app's to `UsageLimitBannerContainer`. Rejected because it churns file paths in specs, tests, and both composers for no reader benefit.

### 3. Props take finished strings, not raw numbers

- `limitText` is the complete translated sentence, and `reset` is `{ isoValue, label, ariaLabel? }`, the shape `formatUsageResetShort` already returns.
- The lib never sees a percent, a period, a locale, or a timestamp to format. So it needs no `Intl`, no label callbacks, and no English sentence defaults.
- The original change chose whole sentences per period and severity so translators can inflect them, and composing them in the lib would undo that.

*Alternative:* `period` + `usedPercent` props with a `labels` object of format callbacks with English defaults. Rejected because it gives six callbacks, an English-only fallback grammar, and date formatting inside a lib.

### 4. Severity enum moves to the lib

`UsageLimitBannerSeverity` (`Warning = 'warning'`, `Reached = 'reached'`) is declared in `libs/conversation-input/src/models/UsageLimitBanner.ts` and exported. The app deletes `UsageBannerSeverity` from `apps/chat/src/types/usage-limits.ts`, and `selectUsageBannerSource` returns the lib enum.

Apps may import from libs, the values are identical, and so dismissal keys (`${deploymentId}:${period}:${severity}`) are unchanged.

`UsagePeriod` stays in the app, because the lib never needs it.

*Alternative:* keep both enums and map between them. Rejected as duplicate truth.

### 5. Close button only when `onClose` is supplied

`closable={onClose != null}`. A closable banner with no handler would render a button that does nothing, so the prop doubles as the switch. The app always passes it.

`closeAriaLabel` is deliberately absent. The kit `Notification` has no prop to forward it to, and the libs rule "Every declared prop must be read" forbids a dead prop. When the kit ships a close-label prop (the `add-usage-limit-banner` task 10.2 issue), a follow-up adds `closeAriaLabel` with an English default here and the app passes `t(ButtonsI18nKeys.Close)`.

### 6. Typography via class props, colours via the kit

- `limitTextClassName` defaults to `'dial-body-semi-text'`, verified against the kit typography scale with `getEntityDetails("typography")` during implementation.
- `resetTextClassName` has no default, so the reset inherits the Notification's message style, exactly as the app renders it today.
- There is no `*Colors` interface and no `buildCssVars`: the lib adds no colour of its own, so a colours prop would be dead.

### 7. Public class `dial-ci-usage-banner`

`CONVERSATION_INPUT_CLASS.usageBanner = 'dial-ci-usage-banner'` goes on the `Notification` root through its `className` (the kit applies `className` to the alert container), merged with the host `className` via `mergeClasses`. The class gets a README class-table row, enforced by `validate:docs`.

### 8. Tests

- **Lib:** `libs/conversation-input/src/components/UsageLimitBannerView/tests/UsageLimitBannerView.spec.tsx` covers:
  - the variant mapping, through a spy on the real `Notification`, the same technique the app spec uses;
  - `role="status"`;
  - `<time>` and `sr-only`, with and without `ariaLabel`;
  - the close button present or absent and its callback;
  - keyboard dismissal;
  - the public and host class;
  - no fixed width;
  - verbatim text.
- **App:** `apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx` keeps every behavioural case: wording, threshold, loading, dismissal, refresh, RTL. Its one variant/prop test switches from spying on the kit `Notification` to spying on `UsageLimitBannerView`'s props (`severity`, `limitText`, `onClose`), since the variant mapping is now the lib's to test.

### States

Loading, empty, below-threshold, dismissed, and fetch-error states stay entirely in the app container (unchanged from `add-usage-limit-banner`: render nothing, or keep the last good value). The view has no state of its own: it renders exactly what it is given and is never mounted in those states.

## Risks / Trade-offs

- **[Lazy chunk]** `NewConversationComposer` lazy-loads `ConversationInput`, so a new static value import from `@epam/ai-dial-conversation-input` could look like it defeats the split. → The app already imports values statically from it (`CONVERSATION_INPUT_CLASS` in `apps/chat/src/context/CelebrationHost.tsx`, plus value imports in `NewConversationComposer.tsx` and `ConversationView.tsx`), so the package is already in the eager graph. Confirm with `npm run build:quiet` that no chunk changes materially.
- **[Kit `className` pass-through]** The public class depends on `Notification` applying `className` to its root, which its type doc states. → The lib spec asserts the class on the `role="status"` element, so a kit regression fails CI.
- **[Prerequisite ordering]** The modified capability `conversation-input-usage-limit-banner` exists only once `add-usage-limit-banner` is archived. → Task 0.1 gates on that, and `openspec validate` catches a missing base at archive time.
- **[Close-label gap persists]** The banner close button's name stays the kit's English default. → Unchanged from today and tracked as a kit issue; Decision 5 defines the follow-up.

## Migration Plan

1. Archive `add-usage-limit-banner` (after its task 10.2 is resolved or explicitly deferred).
2. Land the lib view, enum, class, README, and spec, then switch the app container to it and delete the app enum, all in one PR.
3. Rollback: revert the PR. The app container returns to its inline `Notification`, and the lib exports disappear. No host outside this repo can depend on them until a release ships.

## Open Questions

- None blocking. Whether `resetTextClassName` should default to a scale class (e.g. `'dial-body-text'`) instead of inheriting is a visual call against the Figma frame. The default here preserves today's rendering.
