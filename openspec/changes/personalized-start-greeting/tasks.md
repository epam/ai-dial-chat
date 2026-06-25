## 1. i18n Keys

- [x] 1.1 Add eight greeting keys to `apps/chat/src/i18n/locales/en.json`: `chat.greetingMorning`, `chat.greetingMorningNoName`, `chat.greetingAfternoon`, `chat.greetingAfternoonNoName`, `chat.greetingEvening`, `chat.greetingEveningNoName`, `chat.greetingNight`, `chat.greetingNightNoName`
- [x] 1.2 Add eight corresponding enum members to `ChatI18nKeys` in `apps/chat/src/constants/translation-keys.ts`
- [x] 1.3 Remove the existing `chat.welcomeText` key from `en.json` and the `WelcomeText` member from `ChatI18nKeys` (verify nothing else references it first)

## 2. Greeting Utility

- [x] 2.1 Create `apps/chat/src/utils/greeting.ts` — export the `GreetingTranslations` interface and the pure `getTimeOfDayGreeting(hour, translations, firstName?)` function implementing the four hour-range buckets
- [x] 2.2 Create `apps/chat/src/utils/tests/greeting.spec.ts` — unit tests covering all four hour boundaries, the first-word extraction, and the no-name fallback

## 3. ConversationRoute Integration

- [x] 3.1 In `apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx`, call `useUserProfile()` to get `displayName`, extract the first name (`displayName.split(' ')[0]` or empty when absent), call `useTranslation()` to resolve the eight keys, then call `getTimeOfDayGreeting(new Date().getHours(), translations, firstName)` and pass the result as `welcomeText` to `ConversationInput`

## 4. Verification

- [x] 4.1 Run `npm exec nx lint chat` and fix any errors
- [x] 4.2 Run `npm exec nx test chat` and confirm all tests pass
- [x] 4.3 Run `npm exec nx typecheck chat` (or `build`) and confirm no type errors
