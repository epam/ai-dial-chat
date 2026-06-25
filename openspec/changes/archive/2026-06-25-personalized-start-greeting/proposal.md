## Why

The start screen shows a static, generic message ("Hello World, good day for prompting!") that does not acknowledge the logged-in user or the time of day. Replacing it with a contextual, personalized greeting ("Good afternoon, Will") makes the product feel more welcoming and human without adding complexity.

## What Changes

- The static welcome text on the start screen is replaced with a time-of-day greeting that includes the user's first name.
- Four greeting variants are introduced: **Good morning**, **Good afternoon**, **Good evening**, and **Good night**, driven by the local clock at render time.
- All four variants are added as i18n keys so they are translatable.
- The user's first name is derived from the existing `useUserProfile` hook (`displayName` claim, first word only).
- When no name is available (unauthenticated or no name claim), the greeting falls back to the time-of-day phrase without a name ("Good afternoon").

## Capabilities

### New Capabilities
- `start-view-greeting`: Personalized, time-of-day greeting rendered on the start/welcome screen using the authenticated user's first name and the current local hour.

### Modified Capabilities
<!-- No existing spec-level requirements are changing. -->

## Impact

- `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` — derives the greeting string and passes it as `welcomeText` to `ConversationInput`.
- `apps/chat/src/utils/greeting.ts` — new utility: `getTimeOfDayGreeting(hour, firstName?)` returns the formatted greeting string.
- `apps/chat/src/i18n/locales/en.json` — four new translation keys.
- `apps/chat/src/constants/translation-keys.ts` — four new `ChatI18nKeys` enum members.
- No API changes, no library changes, no routing changes.
