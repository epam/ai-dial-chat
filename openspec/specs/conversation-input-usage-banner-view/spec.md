# conversation-input-usage-banner-view Specification

## Purpose

The presentational `UsageLimitBannerView` in `@epam/ai-dial-conversation-input`: its props contract, rendering through the kit `Notification`, accessibility, and the isolation that keeps every host-specific value (translations, dates, thresholds, dismissal) outside the lib.

## Requirements

### Requirement: Presentational usage banner props contract

`@epam/ai-dial-conversation-input` SHALL export a presentational component
`UsageLimitBannerView` (component file
`libs/conversation-input/src/components/UsageLimitBannerView/UsageLimitBannerView.tsx`)
typed `FC<UsageLimitBannerViewProps>`, together with the string enum
`UsageLimitBannerSeverity` and the interfaces `UsageLimitBannerViewProps` and
`UsageLimitBannerReset`, all from `libs/conversation-input/src/index.ts`.

`UsageLimitBannerSeverity` SHALL have exactly the members `Warning = 'warning'`
and `Reached = 'reached'`.

`UsageLimitBannerViewProps` SHALL be:

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `severity` | `UsageLimitBannerSeverity` | yes | — |
| `limitText` | `string` | yes | — |
| `reset` | `UsageLimitBannerReset` | no | — |
| `onClose` | `() => void` | no | — |
| `limitTextClassName` | `string` | no | `'dial-body-semi-text'` |
| `resetTextClassName` | `string` | no | none (inherits the notification's message typography) |
| `className` | `string` | no | — |

`UsageLimitBannerReset` SHALL be `{ isoValue: string; label: string; ariaLabel?: string }`.

Every exported symbol and every property SHALL carry JSDoc, and each default
SHALL be quoted verbatim in its doc.

State: the component SHALL be stateless. It owns no dismissal, fetching,
threshold, or selection state. The host owns all of it; in this repo that is
`apps/chat/src/components/UsageLimitBanner/UsageLimitBanner.tsx` with the hook
`useUsageLimitBannerDismissal`.

**Feature flag:** none in the lib. Whether the banner is composed at all is the
host's decision. In this repo it depends on `features.usageLimitsControl`, which
is not gated by `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`.

#### Scenario: Minimal call

- **WHEN** a host renders `<UsageLimitBannerView severity={UsageLimitBannerSeverity.Warning} limitText="Daily limit 80% used." />`
- **THEN** a warning banner reads "Daily limit 80% used." with no reset sentence and no close button

#### Scenario: Public API surface

- **WHEN** a host imports `UsageLimitBannerView`, `UsageLimitBannerSeverity`, `UsageLimitBannerViewProps`, and `UsageLimitBannerReset` from `@epam/ai-dial-conversation-input`
- **THEN** every import resolves and type-checks

---

### Requirement: Presentational usage banner rendering

`UsageLimitBannerView` SHALL render the kit `Notification` from `@epam/ai-dial-ui-kit` with:
- `type={NotificationType.SectionMessage}`;
- `variant={NotificationVariant.Warning}` for `UsageLimitBannerSeverity.Warning` and `variant={NotificationVariant.Error}` for `UsageLimitBannerSeverity.Reached`;
- `iconStroke={DIAL_KIT_ICON_STROKE}`;
- `closable` and `onClose` only when `onClose` is supplied.

Its `message` SHALL be `limitText` in an element carrying `limitTextClassName`.
When `reset` is supplied, a single space follows, then `reset.label` in a
`<time dateTime={reset.isoValue}>` carrying `resetTextClassName`.

The component SHALL apply the public class `dial-ci-usage-banner`
(`CONVERSATION_INPUT_CLASS.usageBanner`) together with `className` to the
`Notification` root. It SHALL set no fixed width, so it wraps within whatever
container the host places it in (in this repo, `ConversationInput`'s `aboveInputSlot`).

**RTL impact:** none of its own. The layout is the kit's, and the lib adds no
physical-direction utilities. The warning and error icons are symmetric and
SHALL NOT be mirrored.

#### Scenario: Reached variant with reset

- **WHEN** rendered with `severity={UsageLimitBannerSeverity.Reached}`, `limitText="Monthly limit reached."`, and `reset={{ isoValue: '2026-11-01T00:00:00Z', label: 'Resets on Nov 1.' }}`
- **THEN** `Notification` receives `variant={NotificationVariant.Error}`
- **AND** the text reads "Monthly limit reached. Resets on Nov 1."
- **AND** "Resets on Nov 1." is inside a `<time>` whose `dateTime` is `2026-11-01T00:00:00Z`

#### Scenario: Close button follows onClose

- **WHEN** `onClose` is supplied and the user activates the close button
- **THEN** `onClose` is called once
- **AND WHEN** `onClose` is omitted
- **THEN** no close button renders

#### Scenario: Public class and host class

- **WHEN** rendered with `className="mb-0"`
- **THEN** the banner root carries both `dial-ci-usage-banner` and `mb-0`

---

### Requirement: Presentational usage banner accessibility

- **Live region:** the root SHALL have `role="status"` for both severities, overriding the kit's assertive `role="alert"` for warning and error, because the banner reports state rather than replying to a user action.
- **Spoken reset:** when `reset.ariaLabel` is supplied, the `<time>` SHALL be `aria-hidden` and `reset.ariaLabel` SHALL render in an `sr-only` sibling, because `aria-label` is not reliably announced on `<time>`. When `ariaLabel` is omitted, the `<time>` SHALL stay exposed.
- **Close button:** it is the kit's own, reachable by Tab and operable with Enter/Space. Its accessible name is owned by `@epam/ai-dial-ui-kit`. The lib SHALL NOT declare a close-label prop it cannot forward, and the gap is recorded in `design.md`.
- **Contrast:** text color comes from the kit's Notification tokens. The lib sets no color.
- **Memoisation:** none required. The component is a pure render of its props, and the host memoises the strings it passes.
- **Observability:** none. No telemetry or metrics events are added.
- **Caching:** none. The component holds no data.

#### Scenario: Polite announcement

- **WHEN** rendered with either severity
- **THEN** the root has `role="status"` and no element has `role="alert"`

#### Scenario: Spoken form on a sibling

- **WHEN** `reset.ariaLabel` is "Usage resets Oct 14, 2026, 12:00 AM Coordinated Universal Time"
- **THEN** the `<time>` has `aria-hidden="true"`
- **AND** that text is present in an `sr-only` element after it

#### Scenario: Keyboard dismissal

- **WHEN** a keyboard user tabs to the close button and presses Enter
- **THEN** `onClose` is called

---

### Requirement: Presentational usage banner isolation

The component SHALL receive every host-specific value as a prop. It SHALL NOT
import or reference:
- `react-i18next` or translation keys;
- `@epam/ai-dial-chat-api-client` or any usage DTO;
- an app context, feature flag, environment variable, storage, or routing;
- the warning threshold, period-selection logic, or date formatting (`Intl`).

All user-visible text arrives already translated and formatted (`limitText`,
`reset.label`, `reset.ariaLabel`). The lib's `package.json` dependencies and
peer dependencies SHALL be unchanged by this component.

i18n keys: none in the lib. In this repo, the host reuses the
`conversationInput.usageBanner.*` keys (`ConversationInputUsageBannerI18nKeys`
in `apps/chat/src/constants/translation-keys.ts`).

#### Scenario: No host knowledge in the lib

- **WHEN** the change's `libs/conversation-input` source diff is reviewed
- **THEN** it contains no `react-i18next`, `@epam/ai-dial-chat-api-client`, or `Intl` import or call, and no change to `libs/conversation-input/package.json`

#### Scenario: Any host string renders verbatim

- **WHEN** a host passes `limitText="Tageslimit zu 80 % verbraucht."`
- **THEN** that exact string renders, without the lib altering it
