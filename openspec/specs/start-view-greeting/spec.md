# start-view-greeting Specification

## Purpose

The time-of-day greeting with the user's first name on the start view.

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
