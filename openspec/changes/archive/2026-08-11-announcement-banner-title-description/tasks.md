## 1. Figma reconciliation

- [ ] 1.1 Authorize the `figma` MCP connector (`/mcp` → `figma` → Authenticate, in an interactive Claude Code session; the server is the remote OAuth endpoint `https://mcp.figma.com/mcp` already declared in `.mcp.json`) and confirm its tools appear
- [ ] 1.2 Open node `467-1097` in `-DIAL- Components 2.0` via the `figma` skill; capture bar height, spacing, background and text colors, typography tokens for the title and description, the leading icon, and the title/description separator
- [ ] 1.3 Confirm the mobile variant: whether the title and description stay on one truncating line or stack, and the close control's touch target size
- [ ] 1.4 Verify the captured title and description colors clear AAA (7:1) against the banner background; if the design's description color fails, raise it before implementing rather than shipping a failing token
- [ ] 1.5 Record the resolved values as a short note in this change folder

## 2. Backend — config plumbing

- [x] 2.1 Add `ANNOUNCEMENT_TITLE` and `ANNOUNCEMENT_DESCRIPTION` as optional validated strings in `apps/chat-api/src/config/environment.config.ts`
- [x] 2.2 Add `announcement.title` and `announcement.description` definitions to `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts` with the visibility, value types, defaults, and descriptions the spec requires
- [x] 2.3 Add `announcementTitle: string | null` and `announcementDescription: string | null` to `ClientConfigResponseDto` with full Swagger annotations

## 3. Backend — resolution and sanitization

- [x] 3.1 Extract the footer's `sanitize-html` pass in `app-config.service.ts` into a shared helper rather than duplicating the allowlist, keeping the `%%VERSION%%` substitution footer-specific
- [x] 3.2 Resolve `announcement.title`: trim, treat blank as `null`, return as plain text with no markup interpretation
- [x] 3.3 Resolve `announcement.description` through the shared sanitizer (allowlist tags/attrs, `target="_blank"` + `rel="noopener noreferrer"` forced on non-hash anchors); return `null` when sanitization leaves an empty string
- [x] 3.4 Confirm all three announcement fields resolve independently — no field derived from another, no field suppressed when the legacy message is set

## 4. Backend — tests and contract regeneration

- [x] 4.1 Extend `apps/chat-api/src/app-config/tests/app-config.service.spec.ts`: title/description populated, blank/whitespace → `null`, title not treated as markup, safe description markup preserved
- [x] 4.2 Add sanitization coverage: script/img/handler stripped, `javascript:` neutralized, links forced to `target="_blank"` + `rel="noopener noreferrer"`, description that sanitizes away → `null`
- [x] 4.3 Add independence coverage: title-only, description-only, and legacy-plus-new combinations
- [x] 4.4 Run `npm exec nx test chat-api`, `npm exec nx lint chat-api`, `npm exec nx build chat-api`
- [x] 4.5 Run `npm run openapi` and `npm run openapi:check`, then build and lint `chat-api-client`

## 5. Frontend — context

- [x] 5.1 Extend `AppConfigContext` with `announcementTitle` and `announcementDescription`, defaulting to `null` while loading and on error, with no re-transformation of the backend values
- [x] 5.2 Extend `apps/chat/src/context/tests/AppConfigContext.spec.tsx` with the loading, success, error, backend-omits-field, and one-field-only scenarios

## 6. Frontend — dismissal signature

- [x] 6.1 Add a deterministic announcement-signature helper to an appropriately general file under `apps/chat/src/utils/`, returning the raw HTML string for a legacy-only announcement and a stable serialization of `{ title, description }` otherwise
- [x] 6.2 Update `useAnnouncementDismissal` to store and compare the signature instead of the raw message, keeping `localStorage` and the `TextOfClosedAnnouncement` storage key — dismissal stays persistent, not session-scoped
- [x] 6.3 Extend the hook's tests: dismissal persists, survives reload and browser restart, re-shows on title or description change, re-shows on legacy message change, and a pre-upgrade legacy dismissal still suppresses the banner with no migration

## 7. Frontend — banner component

- [x] 7.1 Compute `hasStructuredContent` in `AnnouncementBanner` and branch: structured line when true, centered legacy layout when false with a non-empty message, nothing otherwise — keeping the legacy branch structurally intact while it adopts the redesigned surface tokens
- [x] 7.2 Build the structured line per the Figma frame: optional leading icon, emphasized title, description in normal weight, close control at the trailing edge, each part omitted entirely (no empty wrapper) when its value is absent
- [x] 7.3 Render the title as a text node and keep the client-side DOMPurify pass on the description and the legacy message
- [x] 7.4 Implement truncation with `min-w-0` + CSS `text-overflow` on the text container so the full string stays in the DOM; keep the close control outside that container so it is never clipped
- [x] 7.5 Style the banner in `AnnouncementBanner.module.scss` / Tailwind using logical properties throughout (`text-start`, `ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`), replacing the current centered layout for the structured branch

## 8. Frontend — accessibility and i18n

- [x] 8.1 Make the region's accessible name reference the configured title, falling back to the generic label when no title is set
- [x] 8.2 Emphasize the title visually without introducing a heading element, and confirm the document outline is unchanged on every route the banner shows on
- [x] 8.3 Mark any decorative leading icon `aria-hidden` and keep the close control's i18n `aria-label`
- [x] 8.4 Add every new key to `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`, reusing existing shared keys where the string already exists
- [x] 8.5 Verify AAA contrast (7:1) for both the title and the description against the banner surface, and a visible focus indicator on the close control

## 9. Frontend — tests and verification

- [x] 9.1 Extend `AnnouncementBanner` tests with the visibility matrix: structured content, legacy-only, title-only, description-only, all-empty, and not-ready states
- [x] 9.2 Add layout tests: title precedes description, precedence of structured content over the legacy message, per-part conditional rendering, start alignment
- [x] 9.3 Add truncation tests: long text keeps single-line height with the full string in the DOM, close control stays reachable, no horizontal overflow
- [x] 9.4 Add sanitization tests for the description and title, and accessibility tests for the region name, absence of a heading, and icon `aria-hidden`
- [x] 9.5 Verify RTL rendering under `dir="rtl"` and both mobile and desktop layouts
- [x] 9.6 Run `npm exec nx test chat`, `npm exec nx lint chat`, `npm exec nx build chat`

## 10. Documentation and rollout

- [x] 10.1 Document `ANNOUNCEMENT_TITLE` and `ANNOUNCEMENT_DESCRIPTION` in the deployment docs, including the HTML allowlist for the description and that overflowing text is silently truncated
- [x] 10.2 Note that `ANNOUNCEMENT_HTML_MESSAGE` remains supported as a fallback, that structured content takes precedence when both are set, and that rollback is "unset the two new variables"
- [x] 10.3 Update any `docs/` page or diagram that describes the announcement banner's content model in the same commit
- [ ] 10.4 Confirm with product that persistent dismissal is intended and the Figma session-scoped note describes prototype behavior (design decision 5); if product wants session scope, raise it as a separate change rather than folding it in here
- [x] 10.5 Run the five-axis quality review (`code-review-and-quality` skill) over the finished diff before merge
