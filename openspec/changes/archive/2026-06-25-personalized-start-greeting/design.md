## Context

The start screen (`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`) currently passes a static i18n string to `ConversationInput`'s `welcomeText` prop. The key `chat.welcomeText` resolves to "Hello World, good day for prompting!".

The user's identity is already available via `useUserProfile()` (in `apps/chat/src/hooks/user-profile/useUserProfile.ts`), which extracts `displayName` from `user.claims['name']`, falling back to email. The hour of day is available from `new Date().getHours()`.

No backend, routing, or library changes are required.

## Goals / Non-Goals

**Goals:**
- Render a time-of-day greeting with the user's first name on the start screen.
- All greeting strings go through i18n so they are translatable.
- Graceful fallback when no name is available (greeting without name).

**Non-Goals:**
- Updating the greeting in real time as midnight passes (page reload is fine).
- Personalisation beyond the user's first name (no role, no locale-specific time formats).
- Modifying the `ConversationInput` lib component — keep changes at the app layer.

## Decisions

### 1. Pure utility function for time-of-day logic

A pure `getTimeOfDayGreeting(hour: number, firstName?: string): string` function is placed in `apps/chat/src/utils/greeting.ts`. It maps the local hour to one of four variants: morning (5–11), afternoon (12–16), evening (17–20), night (21–4). The function accepts pre-translated phrase strings and returns the composed greeting.

**Alternative considered**: inline the logic in the component. Rejected — the utility is independently testable without rendering and the hour-range boundaries belong in one place.

### 2. First name extraction

Only the first word of `displayName` is used (e.g. "Will Smith" → "Will"). This avoids overly long greetings and matches common UX convention. Extraction is done inline in `ConversationRoute` — no need for a separate hook, as it is a single `split(' ')[0]` operation.

**Alternative**: use `shortName` from `useUserProfile`. Rejected — `shortName` is two initials ("WS"), not a first name.

### 3. i18n key structure

Four new keys in `apps/chat/src/i18n/locales/en.json` under the `chat` namespace:

| Key | Value (with name) | Value (no name) |
|-----|------------------|--------------------|
| `chat.greetingMorning` | `"Good morning, {{name}}"` | — |
| `chat.greetingAfternoon` | `"Afternoon, {{name}}"` | — |
| `chat.greetingEvening` | `"Good evening, {{name}}"` | — |
| `chat.greetingNight` | `"Good night, {{name}}"` | — |

When no name is available, `t(key, { name: '' })` produces "Good morning, " with a trailing comma and space. To avoid this, the utility accepts the already-translated phrase (the component calls `t()` with a fallback context or without `name` when `firstName` is absent).

**Revised approach**: use two key variants per period:
- `chat.greetingMorning` → `"Good morning, {{name}}"` (used when name is known)
- `chat.greetingMorningNoName` → `"Good morning"` (used when name is absent)
- `chat.greetingAfternoonNoName` → `"Afternoon"` (used when name is absent)

This keeps translations clean and avoids runtime string trimming.

### 4. No live clock

The greeting is evaluated once on mount. The hour used is `new Date().getHours()` called at render time. No interval or subscription is needed — the start screen is rarely open across a time-of-day boundary.

## Risks / Trade-offs

- **Stale greeting across boundary** — If a user leaves the tab open overnight, the greeting stays "Good evening". Low impact; acceptable.
- **Name availability** — `user.claims['name']` depends on the identity provider including a `name` claim. When absent, the greeting falls back to no-name variant. This is handled explicitly.
- **Translation copy review** — Eight new keys require translator review in all supported locales. Until translated, i18n falls back to the English key value.

## Migration Plan

1. Add eight new keys to `en.json` and the enum in `translation-keys.ts`.
2. Add the utility function and unit tests.
3. Update `ConversationRoute` to derive the greeting and pass it as `welcomeText`.
4. Remove the now-unused `ChatI18nKeys.WelcomeText` key and its `en.json` entry (if nothing else references it).
5. Deploy — no rollback strategy needed; if the greeting breaks it reverts to empty string, not a crash.
