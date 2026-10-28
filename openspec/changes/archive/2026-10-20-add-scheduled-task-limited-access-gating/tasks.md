# Tasks

Slicing strategy: **contract-first** — land the BFF field + OpenAPI contract first (slice 1), then build the frontend slices on the regenerated client. Each subsequent slice is independently verifiable and leaves the app in a working state (`schedulerServiceConsent` absent/`unknown` degrades to today's behavior until its consumer slice lands).

## 1. BFF contract: consent read + response field + OpenAPI

- [x] 1.1 Extract the scheduler-consent read into `SchedulerConsentService` (`apps/chat-api/src/external-services/scheduler-consent.service.ts`, exported by `ExternalServicesModule`): resolve `SCHEDULER_APP_ID`/`SCHEDULER_SERVICE_ID` from `EnvironmentVariables` (same missing-config `ServiceUnavailableException` as today), call `ExternalServicesService.getExternalService`, and map to `SchedulerServiceConsentStatus` (`signed_out` only for an explicit `SIGNED_OUT` on a `DIAL_NATIVE` service; `signed_in` for `SIGNED_IN`; `unknown` otherwise). Rewire `ScheduledTasksService.assertSchedulerConsent` (`apps/chat-api/src/scheduled-tasks/scheduled-tasks.service.ts`) as a thin wrapper that throws the existing `ForbiddenException` (`ScheduledTaskErrorCode.AdminConsentRequired`) on `signed_out` — behavior identical, no `scheduled-tasks-api` requirement change.
  - Verification: `npm run test:file -- apps/chat-api/src/external-services/tests/scheduler-consent.service.spec.ts` (new) and `npm run test:file -- apps/chat-api/src/scheduled-tasks/tests/scheduled-tasks.service.spec.ts` (unchanged expectations still pass).
- [x] 1.2 Add `SchedulerServiceConsentStatus` enum (`signed_in`/`signed_out`/`unknown`) and the required `schedulerServiceConsent` field to `GetOfflineCredentialsResponseDto` (`apps/chat-api/src/offline-credentials/dto/offline-credentials.dto.ts`, Swagger enum metadata), and append the field in `OfflineCredentialsService.getOfflineCredentialsStatus` via `SchedulerConsentService` — a failed consent read logs a warn and returns `unknown` without failing the status call.
  - Verification: `npm run test:file -- apps/chat-api/src/offline-credentials/tests/offline-credentials.service.spec.ts` (new scenarios: `signed_out` relayed; read failure → `200` shape with `unknown`; missing scheduler config → `unknown`).
- [x] 1.3 OpenAPI + generated client: `npm run openapi`, `npm run openapi:check`, then build and lint `chat-api-client`. No frontend wrapper changes needed — `offlineCredentialsApi` (`apps/chat/src/server-api/api-client.ts`) already exposes `getOfflineCredentials`.
  - Verification: `npm run openapi:check` passes with `schedulerServiceConsent` documented on `getOfflineCredentials`.

## 2. Lib pass-through: `chat-hooks` gate result

- [x] 2.1 Thread `schedulerServiceConsent` through `mapOfflineCredentialsResponse` (`libs/chat-hooks/src/offline-credentials/map-offline-credentials-response.ts` — absent/non-enum value defaults to `unknown`), `OfflineCredentialsStatusResult`, and the `useOfflineCredentialsGate` result. No UI interpretation inside the lib; no new imports.
  - Verification: `npm run test:file -- libs/chat-hooks/src/offline-credentials/map-offline-credentials-response/map-offline-credentials-response.spec.ts` (extend; new pass-through + default-`unknown` cases). Architecture guard: the lib sources branch on the field for parsing only — no banner/badge/button rendering, no forbidden imports.

## 3. List page slice: limited-access banner + New task gating

- [x] 3.1 Add the i18n keys `scheduledTasks.limitedAccessBanner.title` ("Limited access.") and `scheduledTasks.limitedAccessBanner.body` ("You can't create or edit tasks. Contact your administrator for more details.") to `apps/chat/src/i18n/locales/en.json` and the matching `ScheduledTasksI18nKeys` members in `apps/chat/src/constants/translation-keys.ts`.
  - Verification: keys present in both files; `npm run validate:docs` covers translation-key drift via spec validation only — no extra script.
- [x] 3.2 Create `ScheduledTasksLimitedAccessBanner` (`apps/chat/src/components/ScheduledTasksLimitedAccessBanner/ScheduledTasksLimitedAccessBanner.tsx` + `tests/`): a thin wrapper that takes the localized title/body as props and renders the kit `Notification` with `variant={NotificationVariant.Error}` and `type={NotificationType.SectionMessage}` — no action, not closable, the error variant's own container styling and built-in `role="alert"`. One line per the design reference: the semibold title span and the description compose into the `message` ReactNode on one baseline row (the kit stacks its `title` prop, which would give two lines).
  - Verification: `npm run test:file -- apps/chat/src/components/ScheduledTasksLimitedAccessBanner/tests/ScheduledTasksLimitedAccessBanner.spec.tsx` (renders title + description on one line, no action/close controls, `role="alert"`).
- [x] 3.3 Make the `ScheduledTasks` lib header render the create button only when `onCreateClick` is provided (`libs/scheduled-tasks/src/components/ScheduledTasks/ScheduledTasks.tsx`); update the lib's README in the same change for the conditional-create contract.
  - Verification: `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx` (new scenario: no callback → no create button; existing scenarios unchanged) and `npm run validate:docs`.
- [x] 3.4 Wire the list page (`apps/chat/src/pages/ScheduledTasksPage/ScheduledTasksPage.tsx`): under `schedulerServiceConsent: 'signed_out'`, render `ScheduledTasksLimitedAccessBanner` in the lib's `banner` slot, suppress the login banner, and pass no `onCreateClick`. Other consent values change nothing.
  - Verification: `npm run test:file -- apps/chat/src/pages/ScheduledTasksPage/tests/ScheduledTasksPage.spec.tsx` (new scenarios: `signed_out` → limited banner + no New task, regardless of `connected`; `signed_in`/`unknown` → unchanged).

## 4. Detail page slice: Edit gating

- [x] 4.1 Gate the header Edit button (`apps/chat/src/pages/ScheduledTaskDetailPage/ScheduledTaskDetailPage.tsx`) on `schedulerServiceConsent !== 'signed_out'` (the route's existing `useOfflineCredentialsGate` result; unresolved check fails open and keeps Edit). No limited-access banner renders on the detail route (review decision — the banner is a list-page surface only); Active/Delete/Start now stay ungated.
  - Verification: `npm run test:file -- apps/chat/src/pages/ScheduledTaskDetailPage/tests/ScheduledTaskDetailPage.spec.tsx` (new scenarios: `signed_out` → no Edit, Active/Delete/Start now render; credentials-failed run + `signed_out` → limited banner, not the login banner).

## 5. Extensions tab slice: three-state row

- [x] 5.1 Update `ExtensionServiceItem` (`libs/settings-panel/src/models/extensions-props.ts`): remove `authorizeLabel`, add optional `limitedAccessLabel`, `limitedAccessTooltipTitle`, and `limitedAccessTooltipDescription`; render in `ExtensionServiceRow` (`libs/settings-panel/src/components/ExtensionsSection/ExtensionServiceRow.tsx`) the warning badge with **no** tooltip in any state (logged-out and `signed_out`), and the kit `Badge` (`BadgeVariant.Filled`, `BadgeColor.Red`) with the `limitedAccessLabel` and a hover tooltip composed inside the kit `Tooltip`'s `tooltip` ReactNode — bold `limitedAccessTooltipTitle` line + normal `limitedAccessTooltipDescription` (hover-only, trigger carries the badge position, span `role="img"` accessible name — the existing warning-badge mechanics) — replacing the action when supplied. Update `libs/settings-panel/README.md` in the same change.
  - Verification: `npm run test:file -- libs/settings-panel/src/components/ExtensionsSection/tests/ExtensionServiceRow.spec.tsx` (new scenarios: logged-out badge carries no tooltip; `signed_out` warning badge carries no tooltip; limited badge renders with bold-title + description tooltip and no action slot; accessible names) and `npm run validate:docs`. Architecture guard: no i18n, no state decisions — the app passes the labels and the row-state fields; the lib renders only.
- [x] 5.2 Add the i18n keys `extensions.service.limitedAccessLabel` ("Limited access") and `extensions.service.limitedAccessTooltipDescription` ("Contact your administrator for more details.") to `en.json` + `ExtensionsI18nKeys`, reuse `ScheduledTasksI18nKeys.LimitedAccessBannerTitle` for the bold tooltip title (the exact same string; the tab already imports `ScheduledTasksI18nKeys`), and delete the now-unused `extensions.service.authorizeTooltip` key and enum member in the same change.
  - Verification: new keys present once, removed key gone from both `en.json` and `apps/chat/src/constants/translation-keys.ts`.
- [x] 5.3 Rewire `ExtensionsTab` (`apps/chat/src/pages/SettingsPage/ExtensionsTab/ExtensionsTab.tsx`) to the three-state decision table: `signed_out` → warning badge + red `Badge` with the limited-access tooltip replacing the action (any `connected`); `signed_in`/`unknown` + `!connected` → warning badge (no tooltip) + Log in; `signed_in`/`unknown` + `connected` → no badge + Log out. Unavailable/checking/error unchanged.
  - Verification: `npm run test:file -- apps/chat/src/pages/SettingsPage/ExtensionsTab/tests/ExtensionsTab.spec.tsx` (new scenarios per the decision table, including `signed_out` + `connected`).

## 6. RTL, docs, and final verification

- [x] 6.1 RTL pass over the new/changed surfaces (limited banner, red badge, conditional header): logical utilities only (`ms/me`, `start/end` — the existing badge's `bottom-[-3px] end-[-10px]` pattern already complies), no directional icons added (warning triangle and `Badge` are symmetric), and a visual RTL check of the Extensions row and the banner.
  - Verification: no physical-direction utilities in the diff; `npm run test:file -- libs/settings-panel/src/components/ExtensionsSection/tests/ExtensionServiceRow.spec.tsx` still green.
- [x] 6.2 Docs: update `apps/chat-api/README.md` (offline-credentials response gains `schedulerServiceConsent`), `libs/chat-hooks/README.md` (gate result field), `libs/scheduled-tasks/README.md` (conditional create button), and `libs/settings-panel/README.md` (`authorizeLabel` → `limitedAccessLabel`) — then `npm run validate:docs` and `npm run validate:specs`.
  - Verification: `npm run validate:docs` and `npm run validate:specs` both pass.
- [x] 6.3 Full verification for the change: `npm run verify:changed` after slice 5, then exactly once `npm run verify:full`, plus `npm run build:quiet` (the `chat-api-client` and lib builds were affected).
  - Verification: all green.

## 7. Review refinements

- [x] 7.1 Pin the Extensions service avatar colour: `InitialsAvatar` (libs/chat-shared) gains the `color` pass-through to the kit `Avatar`, `ExtensionServiceItem` (libs/settings-panel) gains `avatarColor`, and `ExtensionsTab` pins `AVATAR_PALETTE[AvatarColor.Violet1]`.
  - Verification: `npm run test:file -- libs/chat-shared/src/components/InitialsAvatar/tests/InitialsAvatar.spec.tsx`, `npm run test:file -- libs/settings-panel/src/components/ExtensionsSection/tests/ExtensionsSection.spec.tsx`, `npm run test:file -- apps/chat/src/pages/SettingsPage/ExtensionsTab/tests/ExtensionsTab.spec.tsx` (all pass), plus `npm run validate:docs`.
- [x] 7.2 Cap the `ScheduledTasks` lib's `banner` slot to the card grid's `maxWidth` (`gridLayout?.maxWidth`, default `1180px`) so the limited-access banner aligns horizontally with the cards instead of rendering wider.
  - Verification: `npm run test:file -- libs/scheduled-tasks/src/components/ScheduledTasks/tests/ScheduledTasks.spec.tsx` (new alignment scenario passes).
