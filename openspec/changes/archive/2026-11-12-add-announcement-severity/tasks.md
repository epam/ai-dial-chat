Slicing strategy: **contract-first, then vertical**. Slice 1 lands the backend behaviour and the regenerated OpenAPI contract (independently verifiable through the normalizer tests and `openapi:check`). Slice 2 builds the lib enum and mapper on that contract, slice 3 wires the app adapter, slice 4 updates docs. Each slice compiles and passes tests on its own; slice 3 depends on 1 and 2.

## 1. Backend: severity normalization and DTO contract

- [x] 1.1 Add `apps/chat-api/src/app-config/dto/announcement-severity.enum.ts` exporting the string enum `AnnouncementSeverity` (`Info = 'info'`, `Warning = 'warning'`).
- [x] 1.2 Add the required `severity!: AnnouncementSeverity` field to `AnnouncementItemDto` in `apps/chat-api/src/app-config/dto/announcement-item.dto.ts` with `@ApiProperty({ enum, enumName: 'AnnouncementSeverity', example: AnnouncementSeverity.Warning, description })`; the description states the default (`info`) and that clients must treat unknown future values as `info` (follow `ProjectSource` in `apps/chat-api/src/projects/dto/project.dto.ts`).
- [x] 1.3 In `apps/chat-api/src/app-config/announcements.normalizer.ts`, add `parseAnnouncementSeverity` next to `parseAnnouncementLink` (absent/`null` → `info`; trimmed, case-insensitive `info`/`warning` → canonical value; anything else → rejection), call it only after the title and link checks pass, emit exactly one `warn` naming the title and the JSON-stringified rejected value on rejection, and push `severity` on every accepted entry. Update the function JSDoc to say unknown severity falls back rather than dropping.
- [x] 1.4 Extend `apps/chat-api/src/app-config/tests/announcements.normalizer.spec.ts`: existing expectations gain `severity: 'info'`; new cases for absent, `null`, `warning`, `' Warning '`, unknown string (`critical`), blank string, number, a dropped entry (blank title) carrying an unknown severity (no severity warning), and duplicates differing only in severity both kept. Assert warning count per entry.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/announcements.normalizer.spec.ts`
- [x] 1.5 Update any `toEqual` expectations on `config.announcements` that now miss `severity` in `apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts` , `apps/chat-api/src/app-config/tests/app-config.service.spec.ts` and the `announcement.items` expectations in `apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts` (only where they exist; no unrelated edits). Add one service-level case proving `warning` and the `info` default reach `config.announcements`.
  - Verification: `npm run test:file -- apps/chat-api/src/app-config/tests/client-config.mapper.spec.ts apps/chat-api/src/app-config/tests/app-config.service.spec.ts apps/chat-api/src/app-config/tests/config-registry/env-resolution-characterization.spec.ts`
- [x] 1.6 Regenerate the contract: `npm run openapi`, then `npm run openapi:check`; confirm `libs/chat-api-client/openapi.json` and `libs/chat-api-client/src/generated/src/models/index.ts` export `AnnouncementSeverity` and type `AnnouncementItemDto.severity` with it. Do not hand-edit generated files.
  - Verification: `npm exec nx build chat-api-client` and `npm exec nx lint chat-api-client`; `npm exec nx lint chat-api`
- [x] 1.7 Slice check: `npm run verify:changed`.

## 2. Lib: `AnnouncementSeverity` enum and mapper in `@epam/ai-dial-chat-hooks`

- [x] 2.1 In `libs/chat-hooks/src/conversation/announcement-message.ts`, add the exported string enum `AnnouncementSeverity`, the optional `severity?: AnnouncementSeverity` on `AnnouncementListItem` (JSDoc: absent means `Info`), and `mapAnnouncementSeverity(severity: AnnouncementSeverityDto | null | undefined): AnnouncementSeverity` backed by an exhaustive `Record<AnnouncementSeverityDto, AnnouncementSeverity>` with an `Info` fallback (follow `PROJECT_SOURCES` / `mapProjectSource` in `libs/chat-hooks/src/project/project-mapping.ts`). Import the generated const aliased, as `project-mapping` does: `import { AnnouncementSeverity as AnnouncementSeverityDto } from '@epam/ai-dial-chat-api-client'`. Both new names reach the root entry through the existing `export *` in `libs/chat-hooks/src/index.ts`.
- [x] 2.2 Add a JSDoc line to `buildItemsSignature` / `buildAnnouncementSignature` stating that `severity` is deliberately not signed; do not change the projection.
- [x] 2.3 Architecture guard: confirm the change adds no endpoint path, client instance, env/feature-flag, app-context, storage or i18n knowledge to `libs/chat-hooks`, imports only the generated `AnnouncementSeverity` const, and that no entry point's peer set changes (`npm run validate:docs` covers the manifest side).
- [x] 2.4 Add `libs/chat-hooks/src/conversation/tests/announcement-message.spec.ts` covering: `mapAnnouncementSeverity` for `'info'`, `'warning'`, `undefined`, `null` and an unexpected string; `buildAnnouncementSignature` returns the same string for payloads differing only in an entry's severity (incl. absent vs `Info`); and the signature for items without severity is byte-identical to the pre-change format (pinned literal).
  - Verification: `npm run test:file -- libs/chat-hooks/src/conversation/tests/announcement-message.spec.ts`
- [x] 2.5 Slice check: `npm run verify:changed`.

## 3. App: map severity in `AppConfigContext`

- [x] 3.1 In `apps/chat/src/context/AppConfigContext.tsx`, map each `response.config.announcements` entry to `{ ...item, severity: mapAnnouncementSeverity(item.severity) }` inside the existing response-to-state step; keep the `Array.isArray` guard and `[]` default. No other transformation, no new context, hook or `useMemo`.
- [x] 3.2 Extend `apps/chat/src/context/tests/AppConfigContext.spec.tsx`: a `warning` entry surfaces as `AnnouncementSeverity.Warning` with title/description/link unchanged; an entry without `severity` (older backend) surfaces as `AnnouncementSeverity.Info`; update existing announcement fixtures if the generated type now requires `severity`.
  - Verification: `npm run test:file -- apps/chat/src/context/tests/AppConfigContext.spec.tsx`
- [x] 3.3 Fix type errors in existing fixtures that build `AnnouncementItemDto` for the popover/banner tests, only if the required DTO field breaks them (`apps/chat/src/components/AnnouncementsPopover/tests/AnnouncementsPopover.spec.tsx`, `apps/chat/src/components/AnnouncementBanner/tests/AnnouncementBanner.spec.tsx`, `apps/chat/src/hooks/useAnnouncementDismissal/tests/useAnnouncementDismissal.spec.ts`).
  - Verification: `npm run test:file -- apps/chat/src/components/AnnouncementsPopover/tests/AnnouncementsPopover.spec.tsx apps/chat/src/components/AnnouncementBanner/tests/AnnouncementBanner.spec.tsx apps/chat/src/hooks/useAnnouncementDismissal/tests/useAnnouncementDismissal.spec.ts`
- [x] 3.4 Slice check: `npm run verify:changed`.

## 4. Docs

- [x] 4.1 `apps/chat-api/README.md`: extend the `ANNOUNCEMENTS` row with `severity` — values `info` (default) / `warning`, case-insensitive, unknown values logged and treated as `info` (entry kept), returned on every entry, clients should treat unknown future values as `info`, and changing only severity does not re-show a dismissed banner.
- [x] 4.2 `apps/chat-api/.env.template`: add `severity?` to the shape comment and `"severity":"warning"` to the example `ANNOUNCEMENTS` value.
- [x] 4.3 `libs/chat-hooks/README.md`: in the announcement-helpers section, document `AnnouncementSeverity` (members `Info`, `Warning`), `AnnouncementListItem.severity`, and `mapAnnouncementSeverity` with a compiling example; note that `buildAnnouncementSignature` does not sign severity.
- [x] 4.4 Run `npm run validate:docs` and `npm run validate:specs`; fix any reported drift.

## 5. Close-out

- [x] 5.1 Run `npm run verify:full` once. Typecheck, lint and format pass. `test:full` reports two failures outside this change, both reproduced on a clean `development` (`84d16ac0a`): `libs/conversation-input/src/components/AddAttachmentButton/tests/AddAttachmentButton.prompts.spec.tsx`, and `attachment-canvas-consumer-fixture:pack-lib` (`ETARGET` for `@epam/pdf-highlighter-kit@^0.0.22` from the registry). The full `chat-api` and `chat-hooks` suites pass.
- [x] 5.2 Follow-up (out of scope, recorded here; no issue opened): open an issue if Launchpad needs an `error` level or Chat decides to render severity (would require revisiting the dismissal signature, see design D5).
- Follow-up (out of scope): `apps/chat/src/components/ConversationView/tests/NegativeFeedbackModal.spec.tsx` and `apps/chat-api/src/config/tests/explicit-environment.spec.ts` flake under parallel runs on `development` as well.
