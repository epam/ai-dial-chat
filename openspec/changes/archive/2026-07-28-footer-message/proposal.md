## Why

The chat app needs an operator-configurable footer message displayed in the chat input area and mobile user panel, supporting branded legal notices, links, and dialog triggers for API key requests and issue reporting. The existing reference implementation in `docs/footer-message.md` uses raw `dangerouslySetInnerHTML` without sanitization, hash-based dialog triggers that pollute browser history, and plain HTML form fields — all of which need hardening and alignment with the current UI kit and app conventions.

## What Changes

- Introduce `FOOTER_HTML_MESSAGE` env var (operator-supplied HTML); version is auto-injected server-side from `package.json` via `%%VERSION%%` token substitution
- Add server-side HTML sanitization (`sanitize-html`) with an allowlist (`a`, `span`, `strong`, `u`, `br`, `p`) and automatic `target="_blank" rel="noopener noreferrer"` injection on anchor tags
- Add client-side DOMPurify sanitization as a second defensive layer before `dangerouslySetInnerHTML`
- Replace hash-triggered dialog navigation (`window.location.hash`) with a `data-dial-action` click-delegate approach on the footer container — no browser history pollution
- Build two form dialogs — **Request API Key** and **Report an Issue** — using UI kit components with controlled inputs and per-field inline validation errors
- Gate all behavior behind existing feature flags: `footer`, `request-api-key`, `report-an-issue`
- Footer container and dialog layouts use Tailwind logical properties for full RTL support
- Dialogs meet WCAG 2.1 AAA: focus trap, return-focus on close, `<h1>` dialog title, `aria-live` feedback

## Capabilities

### New Capabilities

- `footer-message`: Operator-configurable footer HTML message — env var ingestion, `%%VERSION%%` substitution, two-layer sanitization, `data-dial-action` click delegation, feature flag gate, RTL layout, and a11y
- `footer-dialogs`: Request API Key and Report an Issue modal dialogs — UI kit forms with controlled inputs, per-field inline errors, Redux service slice epics, and BFF API routes

### Modified Capabilities

<!-- No existing spec-level behavior is changing -->

## Impact

- **New files**: `apps/chat/src/components/Footer/` (FooterMessage component + container), `apps/chat/src/components/Footer/dialogs/` (RequestApiKeyDialog, ReportIssueDialog), `apps/chat/src/store/service/` (service slice), `apps/chat/src/pages/api/request-api-key.ts`, `apps/chat/src/pages/api/report-issue.ts`
- **Modified files**: `apps/chat/environment.d.ts` (add env vars), `apps/chat/src/utils/server/get-common-page-props.ts` (sanitization + version injection), `apps/chat/src/components/Chat/ChatInput/ChatInputFooter.tsx`, `apps/chat/src/components/Header/User/UserMobile.tsx`
- **New dependencies**: `sanitize-html` + `@types/sanitize-html` (server-side), `dompurify` + `@types/dompurify` (client-side)
- **No breaking changes** to existing public API surface
