## 1. Backend — expose `announcement.html` through the app-config pipeline

- [x] 1.1 Add `ANNOUNCEMENT_HTML_MESSAGE?: string` (optional string, `@IsOptional() @IsString()`) to `EnvironmentVariables` in `apps/chat-api/src/config/environment.config.ts`.
- [x] 1.2 Append an `announcement.html` `ConfigDefinition` to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` (`type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null`, `critical=false`, `owner='chat-team'`, `envVar='ANNOUNCEMENT_HTML_MESSAGE'`, with a description).
- [x] 1.3 In `apps/chat-api/src/app-config/app-config.service.ts` `getClientConfig`: add a local `announcementHtml: string | null = null`, an `else if (def.key === 'announcement.html')` resolve branch, and include `announcementHtml` in the `response.config` object.
- [x] 1.4 Add `announcementHtml!: string | null` to `ClientConfigDto` in `apps/chat-api/src/app-config/dto/client-config-response.dto.ts` with `@ApiPropertyOptional({ nullable: true, type: String })` (mirror `dialCoreExternalUrl`).
- [x] 1.5 Extend the app-config service spec: assert `announcement.html` resolves from `ANNOUNCEMENT_HTML_MESSAGE` into `config.announcementHtml`, and defaults to `null` when unset.
- [x] 1.6 Regenerate the OpenAPI client and verify: `npm run openapi && npm run openapi:check`, then build/lint `chat-api-client`. Confirm `ClientConfigDto.announcementHtml` appears in `libs/chat-api-client`.

## 2. Frontend — surface the value in app-config context

- [x] 2.1 Add `announcementHtml: string | null` to `AppConfigState.config`, to `INITIAL_STATE.config` (`null`), and to the `loadConfig` mapping (`announcementHtml: response.config?.announcementHtml ?? null`) in `apps/chat/src/context/AppConfigContext.tsx`.

## 3. Frontend — dismissal persistence

- [x] 3.1 Add `TextOfClosedAnnouncement = 'textOfClosedAnnouncement'` to `StorageKey` in `apps/chat/src/types/storage-key.ts`.
- [x] 3.2 Create `apps/chat/src/hooks/useAnnouncementDismissal/useAnnouncementDismissal.ts` wrapping `useLocalStorage<string>(StorageKey.TextOfClosedAnnouncement, '')`, returning `{ dismissedText, dismiss(text) }` (model on `useCatalogSortFilterPreference`). Add a spec under its `tests/` folder.

## 4. Component (`apps/chat`, app-local — superseded a `libs/chat-shared` split)

- [x] 4.1 ~~Create `libs/chat-shared/src/components/AnnouncementBanner/AnnouncementBanner.tsx`~~ — superseded by 5.2: after review the lib/app split was premature abstraction for a single-consumer component (see design.md D4), so the render logic was folded directly into `apps/chat/src/components/AnnouncementBanner/AnnouncementBanner.tsx`.
- [x] 4.2 Style per the exact Figma spec (node `2356:50812`), pulled via Figma MCP rather than eyeballed: two-layer `background-image` (dark `rgba(12,16,29,0.1)` overlay + `linear-gradient(90deg, #00dbde, #fc00ff)`), text/icon color `--controls-text-permanent` (`#fcfcfc`), `gap-3`/`px-4`/`py-2` (Spacing-03/04/02), 24px icon, and a 24×24 close button (16px icon, `p-[3px]`, `rounded`, background `bg-blackout`, icon color forced via Tailwind's `!` important modifier (`!text-controls-permanent`) since `DialCloseButton`'s internal ghost-button class outranks a plain utility class). Lives in `apps/chat/src/components/AnnouncementBanner/AnnouncementBanner.module.scss`, hardcoded (no CSS-var override props — single consumer, no variation needed).
- [x] 4.3 ~~Export `AnnouncementBanner` and `AnnouncementBannerProps` from `libs/chat-shared/src/index.ts`~~ — superseded; nothing is exported from `chat-shared` for this feature.
- [x] 4.4 Tests merged into `apps/chat/src/components/AnnouncementBanner/tests/AnnouncementBanner.spec.tsx` (see 5.4): renders content, close button (queried by role/label) invokes dismiss. No `data-testid`.

## 5. App component + mount

- [x] 5.1 Add i18n keys: an `AnnouncementBannerI18nKeys` enum (close aria-label, region aria-label) in `apps/chat/src/constants/translation-keys.ts` + matching `apps/chat/src/i18n/locales/en.json` entries in the same change (reuse `ButtonsI18nKeys` "Close" if it already exists — grep `en.json` first).
- [x] 5.2 Create `apps/chat/src/components/AnnouncementBanner/AnnouncementBanner.tsx` (`const AnnouncementBanner: FC<Props> = …; export default memo(AnnouncementBanner)`): read `useAppConfig().config.announcementHtml` + `useAnnouncementDismissal()`; sanitize with DOMPurify (`ALLOWED_TAGS: ['a','b','strong','em','br','span']`, `ALLOWED_ATTR: ['href','target','rel']`) memoized; gate visibility (ready + non-empty + `dismissedText !== announcementHtml`); render the banner markup directly (region role, speakerphone icon, sanitized message, `DialCloseButton`) — no `chat-shared` shell; return `null` when hidden.
- [x] 5.3 Mount in `apps/chat/src/app/app.tsx`: wrap the current root row in an outer `<div className="flex size-full flex-col">` with `<AnnouncementBanner />` first and the existing row as `<div className="flex min-h-0 flex-1 flex-row">`. Confirm no layout/scroll regressions with the banner on and off.
- [x] 5.4 Add a spec covering both rendering and visibility/dismissal logic in one file (shows when configured + not dismissed; hidden when empty; re-shows when text changes; sanitized HTML renders; close button triggers dismiss).

## 6. Docs & verification

- [x] 6.1 Document `ANNOUNCEMENT_HTML_MESSAGE` alongside the other `chat-api` env vars (README / env example); use the `dial-docs` skill to check whether a config/architecture doc enumerates client-config values and, if so, add it there in the same commit. (No doc enumerates client-config values; `.env.template` updated.)
- [x] 6.2 Verify backend: `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`, `npm run openapi && npm run openapi:check`. All green (81 test files / 1390 tests).
- [x] 6.3 Verify frontend: `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat` (+ `nx test`/`lint` for `chat-shared`). All green (151 test files / 1709 tests for chat; chat-shared build/test/lint clean).
- [x] 6.4 Manual verification: confirmed live against the running dev servers — `curl http://localhost:3005/api/v1/client-config?appId=chat-ui` returns `config.announcementHtml` correctly from the real running backend. Full authenticated in-browser click-through (dismiss/reload/re-show/XSS-strip) was not completed by the agent — the app requires real Keycloak OIDC login and no dev/mock-auth bypass exists; the agent has no credentials and did not request or guess any. The already-running dev servers were left untouched (not restarted) since they appeared to be in active use.
