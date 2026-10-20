## Why

`add-usage-limit-banner` built the composer's usage banner entirely in the app (`apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`). About half of that file is host-agnostic presentation: the kit `Notification` setup, the polite live region, the semibold limit sentence, and the `<time>` reset sentence with its screen-reader expansion. A second host that embeds `@epam/ai-dial-conversation-input` and wants the same banner would have to copy that markup and its a11y decisions, and the two copies would drift. Moving the view into the lib that already owns the slot it renders through (`aboveInputSlot`) gives hosts one reusable, documented component. Data, policy, and translations stay in each host.

## What Changes

- **New lib component `UsageLimitBannerView`** in `@epam/ai-dial-conversation-input`. It is purely presentational and takes resolved values through props:
  - `severity: UsageLimitBannerSeverity` (`Warning` / `Reached`), mapped to the kit `NotificationVariant.Warning` / `NotificationVariant.Error`;
  - `limitText: string`, the already-translated period sentence ("Daily limit 80% used.");
  - `reset?: UsageLimitBannerReset` (`{ isoValue, label, ariaLabel? }`), the already-formatted reset sentence and its spoken form;
  - `onClose?: () => void`; the close button is shown only when this is supplied;
  - typography class props (`limitTextClassName`, default `'dial-body-semi-text'`; `resetTextClassName`, optional) and `className`.
- It renders the kit `Notification` with `type={NotificationType.SectionMessage}`, `role="status"`, and `iconStroke={DIAL_KIT_ICON_STROKE}`. The reset is an `aria-hidden` `<time dateTime>` plus an `sr-only` spoken sibling, the pattern `@epam/ai-dial-usage-dashboard` already uses.
- **New public class `dial-ci-usage-banner`** on the banner root, added to `CONVERSATION_INPUT_CLASS` and the README class table.
- **New exported string enum `UsageLimitBannerSeverity`**, which replaces the app's `UsageBannerSeverity` (`apps/chat/src/types/usage-limits.ts`). The values (`'warning'`, `'reached'`) are identical, so dismissal keys do not change.
- **The app container stays at `apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx`**, with the same props and behaviour. It keeps fetching, threshold, source-row selection, reset formatting, i18n, dismissal, and refresh-after-generation, and now renders `UsageLimitBannerView` instead of `Notification`.

No user-visible behaviour changes: same wording, variants, role, dismissal, and layout.

## Capabilities

### New Capabilities

- `conversation-input-usage-banner-view`: the lib's presentational `UsageLimitBannerView`, covering its props contract, rendering, accessibility, public class, and isolation boundary.

### Modified Capabilities

- `conversation-input-usage-limit-banner` (introduced by `add-usage-limit-banner`): the "Banner rendering and wording" and "Banner accessibility, direction, and memoisation" requirements change. The app banner now composes `UsageLimitBannerView` instead of rendering the kit `Notification` itself, and the severity enum moves to the lib. **Prerequisite:** `add-usage-limit-banner` must be archived first, so this capability exists under `openspec/specs/` when this change archives.

## Non-goals

- Moving data fetching, the threshold, `selectUsageBannerSource`, `formatUsageResetShort`, the dismissal store, the refresh hook, or the feature-flag XOR into any lib.
- Moving `selectUsageBannerSource` into `libs/chat-hooks` (the fourth isolation exception). That is a separate change once the helper has a stable test history.
- A translatable close-button name. The kit `Notification` exposes no label prop, so the lib cannot offer one without declaring a dead prop. It remains the kit gap tracked by `add-usage-limit-banner` task 10.2.
- Any change to `UsageLimitsControl` or `ConversationInput`.

## Alternatives considered

- **Keep the view in the app (baseline).** It has zero risk, but leaves every other host to re-implement the a11y-sensitive markup. Rejected because embeddability is the purpose of `libs/conversation-input`.
- **Put it in `@epam/ai-dial-usage-dashboard`.** That lib owns the Settings → Usage view and the same `<time>` pattern, but `conversation-input` would then depend on it, or the host would install a second package to fill a `conversation-input` slot. Rejected.
- **A new `libs/usage-banner` package.** It means a new package, README, manifest, `architecture.md` row, and install-matrix entry for one small component. Rejected as disproportionate.
- **Pass the period and percent and let the lib build the sentence with English defaults.** Translators then lose whole-sentence control (the original change chose full sentences per period/severity for inflection), and the lib would carry a `labels` object of six format callbacks. Rejected; the host passes the finished sentence.

## Acceptance criteria

- `UsageLimitBannerView` is exported from `@epam/ai-dial-conversation-input`, with `UsageLimitBannerSeverity`, `UsageLimitBannerViewProps`, and `UsageLimitBannerReset`, and is documented in the lib README with an example that matches the source.
- `libs/conversation-input` gains no usage DTO, threshold, feature flag, i18n, generated-client import, app context, or new dependency. `git diff -- libs/conversation-input/package.json` is empty.
- Every behavioural case in `apps/chat/src/components/UsageLimitBanner/tests/UsageLimitBanner.spec.tsx` still passes unchanged: wording, threshold, loading, dismissal, refresh, RTL, and width. The single variant/prop test moves from spying on the kit `Notification` to spying on `UsageLimitBannerView`, and the variant mapping is covered in the lib spec instead. The rendered DOM roles, text, `<time>` attributes, and variant are unchanged.
- `apps/chat/src/types/usage-limits.ts` no longer declares `UsageBannerSeverity`; no references remain.
- `npm run validate:docs` passes, including the `dial-*` class-table check.

## Rollback / compatibility

The change is additive for the lib (new exports) and internal for the app. To revert, restore the app's inline `Notification` and its local enum, then remove the lib exports. Hosts that never import the view are unaffected.

## Impact

- **`libs/conversation-input` (shared lib, scope flag):** new component and co-located spec, a new enum and types in `models/`, a new `CONVERSATION_INPUT_CLASS` entry, `index.ts` exports, and README sections (component, enum, class table). Host knowledge stays out: the app passes the translated `limitText`, the formatted `reset`, the severity it computed, and the `onClose` that writes its dismissal store.
- **`apps/chat`:** `UsageLimitBanner.tsx` renders the lib view. `UsageBannerSeverity` is removed from `apps/chat/src/types/usage-limits.ts`, and `apps/chat/src/utils/usage-limits.ts`, its spec, and the banner spec import the lib enum.
- **Docs:** `docs/technical-requirements.md` ("Token-usage limits control") names the lib view. `docs/architecture.md` is unaffected: no lib, context, or route is added.
- **i18n:** no new strings. The existing `conversationInput.usageBanner.*` keys are reused unchanged.
