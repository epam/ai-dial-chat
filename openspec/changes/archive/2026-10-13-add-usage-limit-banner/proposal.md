## Why

`UsageLimitsControl`, the dial next to the model selector, is now behind `features.usageLimitsControl` and off by default (PR #9387). With the flag off, a user approaching or hitting a token or cost limit gets no warning in the composer. The design replaces it, by default, with a dismissible banner directly above the input:

- **Running low:** a warning icon and "{Daily|Weekly|Monthly} limit 80% used. Resets at {time|date}."
- **Exhausted:** an error icon and "{Daily|Weekly|Monthly} limit reached. Resets at {time|date}."

## What Changes

- **New `UsageLimitBanner`** (app-owned, `apps/chat/src/components/UsageLimitBanner/`). It renders a kit `Notification` (`type={NotificationType.SectionMessage}`, `closable`):
  - `NotificationVariant.Warning` while the worst capped day/week/month row (token or cost) is at or above the warning threshold and below 100%.
  - `NotificationVariant.Error` once that row is at or above 100%.
  - It names the period, the actual percentage (warning only), and the period's reset time.
- **Shown instead of the dial, never with it.** Both composers render the banner while `useFeatureFlag('usageLimitsControl')` is `false` (the default) and the dial while it is `true`.
- **Dismissal lasts until things get worse.** Closing the banner hides it until one of these changes: the deployment, the period that triggered it, or the severity (warning → reached). The dismissal lives in memory only.
- **Configurable threshold.** New env var `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT`: integer 1–99, default `75`. It is exposed to the client as `config.usageLimitsWarningThresholdPercent` and decides when the banner appears. The dial and the Settings → Usage page keep their fixed 75% running-low mark, which is out of scope.
- **New generic slot `aboveInputSlot?: ReactNode`** on `@epam/ai-dial-conversation-input`'s `ConversationInput`. It renders inside the input-width container, directly above `Input`; omitting it leaves the layout unchanged. The lib knows nothing about usage.
- **The banner refreshes its usage after a response finishes**, as the dial does. The refresh-after-generation effect moves out of `UsageLimitsControl` into a hook that both components share.
- New i18n keys under `conversationInput.usageBanner.*`, added to every locale.

## Capabilities

### New Capabilities

- `conversation-input-usage-limit-banner`: the default warning/reached banner above the composer, including its threshold config, dismissal rules, reset-time wording, and the `aboveInputSlot` it renders through.

### Modified Capabilities

- `conversation-input-usage-limits`: the "Isolated Conversation Input integration" requirement changes. While the flag is off, the composers pass the banner through `aboveInputSlot` instead of passing nothing.

## Non-goals

- Changing the dial's own 75% mark, `CatalogLimitStatus`, or the Settings → Usage page.
- Persisting dismissal across reloads (localStorage) or per user.
- Showing the minute-rate stats. They stay excluded for the same reason as in the dial: they are a rolling counter the user cannot act on.
- Blocking sending when the limit is reached. The banner informs; DIAL Core still enforces the limit.
- Role-gating the banner.

## Alternatives considered

- **Render the banner in the app above `<ConversationInput>`** with no lib change. Rejected because the lib owns the composer's width (`max-w-[700px]` on the welcome screen, `max-w-[748px]` in a conversation) and its padding. An external element would have to copy both, and it would drift.
- **Reuse `UsageLimitsControl`'s mapped `CatalogItemLimits`.** Rejected because `mapDeploymentLimitsToInput` drops every row below its fixed 75% ratio. A configurable threshold below 75 would then never see those rows, so the banner reads the raw `DeploymentLimitsResponseDto` through a new pure helper instead.
- **Reuse `AnnouncementBanner`.** Rejected because it is a page-level, persisted, operator-authored banner with its own dismissal storage. The kit `Notification` already matches the design (icon, closable, warning/error variants).

## Acceptance criteria

- With `USAGE_LIMITS_CONTROL_ENABLED` unset, no limit at or above 75%: no banner and no dial.
- With the worst row at 80% of the daily limit, a warning banner reads "Daily limit 80% used. Resets at {time}." above the input, in both the new-chat composer and an open conversation.
- With any row at or above 100%, an error banner reads "{Period} limit reached. Resets at {…}."
- With `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT=90`, a row at 80% shows no banner, and a row at 92% does.
- After the banner is dismissed, it stays hidden while usage moves from 80% to 85% on the same period. It reappears when the period's usage reaches 100% or when the user switches to a deployment over the threshold.
- With `USAGE_LIMITS_CONTROL_ENABLED=true`, the dial renders and the banner never does.
- With `aboveInputSlot` omitted, `ConversationInput` renders exactly as before.

## Rollback / compatibility

The change is additive and not breaking. `aboveInputSlot` is an optional prop, and the new config field has a default. To return to "nothing by default", revert the change. Operators can get the dial back without a deploy by setting `USAGE_LIMITS_CONTROL_ENABLED=true`.

## Impact

- **`apps/chat-api`:**
  - `USAGE_LIMITS_WARNING_THRESHOLD_PERCENT` in `apps/chat-api/src/config/environment.config.ts`;
  - a `config` entry in `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`, modelled on `attachments.maxFileSizeBytes`;
  - the mapping in `apps/chat-api/src/app-config/client-config.mapper.ts`;
  - the field `usageLimitsWarningThresholdPercent` on `ClientConfigResponseDto`, which means an OpenAPI regeneration and a `chat-api-client` rebuild;
  - `apps/chat-api/README.md` and `.env.template`.
- **`apps/chat`:**
  - `AppConfigContext` (new config field and its default);
  - the new `UsageLimitBanner` component and the shared refresh hook;
  - helpers in `apps/chat/src/utils/usage-limits.ts` and `apps/chat/src/utils/usage-reset-time.ts`;
  - `ConversationView` and `NewConversationComposer` slot wiring;
  - `UsageLimitsControl` (moves its refresh effect into the shared hook);
  - translation keys and every locale JSON.
- **`libs/conversation-input` (shared lib, scope flag):** one optional `ReactNode` slot in `ConversationInput`, plus its README and JSDoc. No host knowledge enters the lib: the app supplies the rendered banner.
- **Docs:** `docs/technical-requirements.md` ("Token-usage limits control"). `docs/architecture.md` needs no update, because no lib, context, or route is added.
- **i18n:** new user-visible strings (period names, the warning and reached sentences, the reset wording, and the close button's aria-label), added to every locale.
