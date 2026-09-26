# start-view-greeting Specification

## Purpose

The time-of-day greeting with the user's first name on the start view, and the operator-configurable description line shown beneath it.

## Requirements

### Requirement: Time-of-day greeting with user first name
The start screen SHALL display a personalized greeting that reflects the current local time of day and the authenticated user's first name.

The greeting phrase is determined by the local hour at render time:
- Hour 5–11 (inclusive): "Good morning"
- Hour 12–16 (inclusive): "Afternoon"
- Hour 17–20 (inclusive): "Good evening"
- Hour 21–23 and 0–4 (inclusive): "Good night"

When the user's first name is available, the greeting SHALL append `, <FirstName>` (e.g., "Afternoon, Will"). The first name is the first word of the `name` claim from the identity provider, accessed via `useUserProfile().displayName`.

When no name is available (unauthenticated or no `name` claim), the greeting SHALL render as the time-of-day phrase only (e.g., "Afternoon").

**i18n keys** (namespace `chat`):
- `chat.greetingMorning` → `"Good morning, {{name}}"`
- `chat.greetingMorningNoName` → `"Good morning"`
- `chat.greetingAfternoon` → `"Afternoon, {{name}}"`
- `chat.greetingAfternoonNoName` → `"Afternoon"`
- `chat.greetingEvening` → `"Good evening, {{name}}"`
- `chat.greetingEveningNoName` → `"Good evening"`
- `chat.greetingNight` → `"Good night, {{name}}"`
- `chat.greetingNightNoName` → `"Good night"`

**State ownership**: Logic lives in `ConversationRoute` (app-level page component). The resulting string is passed to `ConversationInput`'s existing `welcomeText` prop — no lib changes required.

**RTL impact**: The greeting is a plain text string rendered by the existing `welcomeText` prop. The `ConversationInput` component already handles text direction through its root element's inherited `dir` attribute. No additional logical properties or icon mirroring are needed.

**Feature gate**: None. Personalized greeting is always enabled.

**Accessibility**: The greeting replaces the existing `welcomeText` which is already read by screen readers. No new ARIA roles or labels required.

**Memoization**: The greeting string is derived from `useUserProfile().displayName` and `new Date().getHours()`. It is a pure derivation with no expensive computation; no `useMemo` is required.

**Observability**: None required for this feature.

#### Scenario: Morning greeting with name
- **WHEN** the local hour is between 5 and 11 (inclusive) and the user's name claim is "Will Smith"
- **THEN** the start screen SHALL display "Good morning, Will"

#### Scenario: Afternoon greeting with name
- **WHEN** the local hour is between 12 and 16 (inclusive) and the user's name claim is "Will Smith"
- **THEN** the start screen SHALL display "Afternoon, Will"

#### Scenario: Evening greeting with name
- **WHEN** the local hour is between 17 and 20 (inclusive) and the user's name claim is "Will"
- **THEN** the start screen SHALL display "Good evening, Will"

#### Scenario: Night greeting with name
- **WHEN** the local hour is 21, 22, 23, 0, 1, 2, 3, or 4 and the user's name claim is "Will"
- **THEN** the start screen SHALL display "Good night, Will"

#### Scenario: Greeting without name claim
- **WHEN** the user has no `name` claim in their identity token
- **THEN** the start screen SHALL display the time-of-day phrase only (e.g., "Afternoon")

#### Scenario: Multi-word display name uses first word only
- **WHEN** the user's `name` claim is "Will Smith"
- **THEN** only "Will" is appended to the greeting phrase

### Requirement: Greeting utility is independently testable
A pure function `getTimeOfDayGreeting` in `apps/chat/src/utils/greeting.ts` SHALL accept the local hour (0–23) and an optional first name, and return the appropriately selected greeting phrase string.

The function signature is:
```ts
getTimeOfDayGreeting(hour: number, translations: GreetingTranslations, firstName?: string): string
```

Where `GreetingTranslations` is an object carrying the eight pre-translated phrase strings so the function remains pure and testable without i18n setup.

#### Scenario: Utility returns morning phrase at hour 9
- **WHEN** `getTimeOfDayGreeting(9, translations, 'Will')` is called
- **THEN** it SHALL return the morning-with-name phrase from `translations`

#### Scenario: Utility returns night phrase at hour 2
- **WHEN** `getTimeOfDayGreeting(2, translations, 'Will')` is called
- **THEN** it SHALL return the night-with-name phrase from `translations`

#### Scenario: Utility returns no-name variant when firstName is absent
- **WHEN** `getTimeOfDayGreeting(14, translations)` is called without a third argument
- **THEN** it SHALL return the afternoon-no-name phrase from `translations`

---

### Requirement: Operator-configurable description below the greeting

The start screen SHALL display a short line of copy below the greeting heading, sourced from `useAppConfig().config.welcomeScreenDescription` (see the `app-config-context` and `client-config-endpoint` capabilities), not hardcoded or translated through i18n.

`NewConversationComposer` SHALL pass this value to `ConversationInput`'s `descriptionText` prop as `welcomeScreenDescription ?? undefined`. When the value is `null` (operator has not configured `WELCOME_SCREEN_DESCRIPTION`), no description SHALL render and no extra spacing SHALL be introduced.

`ConversationInput` (`libs/conversation-input`) SHALL render `descriptionText`, when both it and `welcomeText` are present, as a `<p>` beneath the welcome `<h1>`, both wrapped in a shared column with `gap-4` (16px) between them. `descriptionText` SHALL be ignored (never rendered) when `welcomeText` is absent. The paragraph SHALL be capped at `max-w-[540px]` so long operator copy wraps instead of stretching the layout, and its default typography SHALL be `dial-body-paragraph-text`, overridable via `styles.typography.descriptionClassName`; its color SHALL default to `--text-secondary`, overridable via `styles.colors.descriptionText` (CSS var `--ci-description-color`).

The gap between the welcome/description column and the chat input below it SHALL be `gap-9` (36px), up from the prior `gap-6` (24px), applied unconditionally (not only when a description is present) since the ticketed spacing change targets the welcome-heading-to-input distance generally.

The welcome heading's default typography is unchanged in the lib (`dial-display2-text`); the app SHALL override it to `font-light text-4xl` (Light, 36px) via `styles.typography.welcomeClassName` in `NewConversationComposer`, since no kit type-scale class matches that exact weight/size combination.

**RTL impact:** None beyond what `ConversationInput` already provides — the description is plain text in a `text-center` column, no directional icons or logical-property gaps beyond the existing `gap-*` utilities (which are direction-agnostic).

**i18n impact:** None — the copy is operator-authored config text, not a translated string; no `t()` call or `en.json` key is involved.

**Accessibility:** The description is a plain `<p>` with no interactive semantics; it does not need an ARIA role. It is read by screen readers as regular content following the `<h1>` greeting.

**Feature gate:** None — presence is entirely determined by whether `WELCOME_SCREEN_DESCRIPTION` is configured.

#### Scenario: Description renders below the greeting when configured

- **WHEN** `useAppConfig().config.welcomeScreenDescription` is `"Your secure, all-in-one AI assistant for web search, document analysis, research, brainstorming, and more."`
- **THEN** the start screen renders that text as a paragraph directly below the greeting heading

#### Scenario: No description renders when unconfigured

- **WHEN** `useAppConfig().config.welcomeScreenDescription` is `null`
- **THEN** the start screen renders the greeting heading with no description paragraph beneath it

#### Scenario: Description is capped at 540px and wraps

- **WHEN** the configured description text is long enough to exceed 540px at the current font size
- **THEN** it wraps onto multiple lines rather than stretching wider than 540px

#### Scenario: descriptionText is ignored when welcomeText is absent

- **WHEN** `ConversationInput` is rendered with `descriptionText` set but `welcomeText` empty or absent
- **THEN** no description paragraph is rendered

#### Scenario: Welcome heading renders Light 36px

- **WHEN** the start screen renders the greeting heading
- **THEN** it is styled `font-light text-4xl` (36px, font-weight 300), not the lib's `dial-display2-text` default
