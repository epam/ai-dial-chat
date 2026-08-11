## 1. Backend — config and DTOs

- [x] 1.1 Add `ANNOUNCEMENTS` as an optional validated string in `apps/chat-api/src/config/environment.config.ts`
- [x] 1.2 Add the `announcement.items` definition to `config-registry.constants.ts` (`json`, client-visible, `[]` default, `envVar='ANNOUNCEMENTS'`)
- [x] 1.5 Add a dedicated parse branch for `announcement.items` in `env-config.provider.ts` — the generic env path does not coerce `valueType='json'` and hands the raw string downstream, where the array guard silently resolves it to `[]`
- [x] 1.3 Add `AnnouncementLinkDto` and `AnnouncementItemDto` in `apps/chat-api/src/app-config/dto/announcement-item.dto.ts` with `@ApiProperty` metadata on every field
- [x] 1.4 Add `announcements: AnnouncementItemDto[]` to `ClientConfigResponseDto` with Swagger annotations

## 2. Backend — validation and sanitization

- [x] 2.1 Implement entry normalization in `AppConfigService`: drop entries with a blank title; keep entries with no link; drop entries whose link is present but has a blank label or a non-`http(s)` href (parsed via `new URL`, not prefix-matched)
- [x] 2.2 Sanitize each entry description with the existing `sanitizeAnnouncementHtml`, returning `null` when it sanitizes away; return title and link label as plain text
- [x] 2.3 Log a `logger.warn` naming the entry and the reason for every rejected entry, malformed payload, and non-array root; never throw
- [x] 2.4 Cap the list at 10 entries, dropping and logging the excess
- [x] 2.5 Confirm invalid announcements config never suppresses the banner's own title/description fields

## 3. Backend — tests and contract

- [x] 3.1 Add service coverage: complete entry returned, unset → `[]`, entry without a link kept, invalid link href dropped, blank link label dropped, blank title dropped, one bad entry not discarding good ones
- [x] 3.2 Add sanitization coverage: description script stripped, description that sanitizes away → `null`, title not treated as markup
- [x] 3.3 Add degradation coverage: non-array value → `[]` with banner fields intact, cap enforcement, order preserved
- [x] 3.6 Add provider coverage asserting `Array.isArray` of the resolved value, so a raw string passing through is caught rather than only its contents being checked
- [x] 3.4 Run the chat-api unit tests, lint, and build
- [x] 3.5 Run `npm run openapi` and `npm run openapi:check`, then build `chat-api-client`

## 4. Frontend — model and context

- [x] 4.1 Add `AnnouncementItem` and `AnnouncementLink` interfaces in `apps/chat/src/models/announcement.ts`
- [x] 4.2 Extend `AppConfigContext` with `announcements`, defaulting to `[]` while loading and on error, normalizing non-array values
- [x] 4.3 Extend the context tests with the loading, success, error, normalization, and reference-stability scenarios

## 5. Frontend — popover component

- [x] 5.1 Create `AnnouncementsPopover` on the ui-kit `Dropdown` with `renderOverlay`, controlled `open` + `onOpenChange`, `placement="bottom-end"`, `matchReferenceWidth={false}`, and a `maxDropdownHeight` cap
- [x] 5.2 Render the pill as the ui-kit `NeutralButton`, passing through `aria-expanded`, `aria-haspopup`, `aria-controls` (wired to a `useId()` overlay id) and an `id` for focus restoration, with an i18n accessible name carrying a pluralized count
- [x] 5.3 Render the overlay as a labeled region containing a `<ul>` with one `<li>` per announcement, titles as text (no headings)
- [x] 5.4 Render each row's description via the shared `sanitizeAnnouncementHtml`, omitting the element entirely when absent
- [x] 5.5 Render each row's link as an external anchor, omitted entirely when absent, with a visually-hidden new-tab hint
- [x] 5.6 Close on `Escape` and return focus to the pill, via a document-level listener bound only while open (portal-safe, and avoids making a `div` an interaction target); look the pill up by `id` rather than a `ref`, since ref-forwarding is a ui-kit implementation detail
- [x] 5.7 Style with logical properties throughout; no physical direction utilities

## 6. Frontend — banner integration

- [x] 6.1 Render `AnnouncementsPopover` in the structured banner branch between the truncating text container and the close control
- [x] 6.2 Make the pill `shrink-0` so long banner text truncates around it
- [x] 6.3 Leave the legacy centered branch untouched — no pill there

## 7. Frontend — i18n and tests

- [x] 7.1 Add the pill label (pluralized count), the popover region label, and the new-tab hint to `translation-keys.ts` and `en.json`
- [x] 7.2 Add popover tests: pill count, open/close by pill, outside click, `Escape` + focus return, row order, per-part conditional rendering, link attributes
- [x] 7.3 Add accessibility tests: `aria-expanded` transitions, `aria-controls` wiring, list semantics, no headings, new-tab hint
- [x] 7.4 Add sanitization tests for row descriptions and titles
- [x] 7.5 Add banner integration tests: pill position between text and close control, no pill without announcements, legacy layout unaffected
- [x] 7.6 Run the chat unit tests, lint, and build

## 8. Documentation and rollout

- [x] 8.1 Document `ANNOUNCEMENTS` in `apps/chat-api/.env.template` with the JSON shape, the `http`/`https`-only rule, the entry cap, and the drop-and-log contract
- [ ] 8.2 Note `ANNOUNCEMENTS` in the release notes' Deployment Changes section at release time. (There is no separate deployment doc in this repo — `.env.template` from 8.1 is the operator-facing reference, and `docs/` describes no announcement behaviour, so nothing there needs updating.)
- [ ] 8.3 Raise the ui-kit gap — no anchor-capable `Button` (`as`/`href`) — against `@epam/ai-dial-ui-kit`
- [ ] 8.4 Take the dismissal tension from `proposal.md` to product: dismissing the banner currently hides the announcements permanently
- [x] 8.5 Run the five-axis quality review over the finished diff before merge

## 9. Figma reconciliation (blocked on connector authorization)

- [ ] 9.1 Open node `467-1097` and capture popover width, row spacing, separators, pill styling and count format, and whether rows carry an icon
- [ ] 9.2 Confirm the entry cap and the mobile presentation of the pill and popover
- [ ] 9.3 Verify pill and row-title contrast against the Figma surface (AAA 7:1), and re-confirm the deliberate `text-secondary` choice for row descriptions against the design tokens
