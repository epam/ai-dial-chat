## Context

The chat app needs an operator-configurable footer message: an HTML string supplied via `FOOTER_HTML_MESSAGE` that appears below the chat input (desktop) and in the mobile user panel. Operators may include links that trigger in-app modal dialogs — **Request API Key** and **Report an Issue** — each of which submits a form to a NestJS BFF endpoint that proxies the request to an Azure Functions backend.

## Goals / Non-Goals

**Goals:**
- Server-side `%%VERSION%%` token substitution from `package.json`
- Two-layer HTML sanitization (server-side `sanitize-html` + client-side DOMPurify)
- `data-dial-action` click delegation for dialog triggers
- Two UI kit form dialogs with controlled inputs and per-field inline validation
- NestJS BFF endpoints for both form submissions
- RTL support (logical Tailwind classes throughout)
- WCAG 2.1 AAA (focus trap, return focus, `<h1>` dialog title, `aria-live` feedback)

**Non-Goals:**
- Rich HTML authoring UI for operators
- Non-Azure Functions backends
- Persisting request/issue history client-side

## Decisions

### D1 — Local React state + custom submission hooks; no Redux

Dialog open/closed state is pure UI state. Following the existing modal pattern (e.g. `LogoutConfirmationModal`, `NegativeFeedbackModal`), dialogs are prop-driven: they receive `isOpen` and `onClose` props and own no open/close state themselves. A `FooterContainer` component owns `isRequestApiKeyOpen` and `isReportIssueOpen` state and passes them down. Form field values and submission state live inside each dialog via local `useState`. Submission is encapsulated in `useRequestApiKey` / `useReportIssue` hooks.

### D2 — `data-dial-action` click delegation

A delegated `onClick` on the footer container reads `event.target.closest('[data-dial-action]')?.dataset.dialAction` and opens the matching dialog. This avoids `hashchange` listeners, browser history entries, and back-button side effects.

Operators author: `<a data-dial-action="requestApiKey" href="#">Request API Key</a>`. The `href="#"` prevents broken-link on right-click; `e.preventDefault()` is called in the handler.

**Rejected:** `window.location.hash` — pollutes history and couples UI state to URL.

### D3 — Server-side `sanitize-html` + client-side DOMPurify (defense in depth)

`sanitize-html` (Node) runs in the NestJS `app-config` service when building the config response. Allowlist: `a`, `span`, `strong`, `u`, `em`, `br`, `p`. The sanitizer also adds `target="_blank" rel="noopener noreferrer"` to every `<a>`. The sanitized value is included in the `GET /api/v1/app-config` response as `footerHtmlMessage` and read client-side via `useAppConfig().config.footerHtmlMessage`.

DOMPurify runs in the `FooterMessage` component before `dangerouslySetInnerHTML` as a second defensive layer.

**Rejected:** Server-side only — DOMPurify is cheap and guards against dev/test injection paths where the server pass may be bypassed.

### D4 — NestJS BFF endpoints at `/api/v1/footer/request-api-key` and `/api/v1/footer/report-issue`

Follows NestJS conventions in `apps/chat-api/AGENTS.md`: URI-versioned controller, thin service, validated DTOs, typed HTTP exceptions. The service reads `AZURE_FUNCTIONS_API_HOST`, `REQUEST_API_KEY_CODE`, and `REPORT_ISSUE_CODE` from `ConfigService` and proxies with the authenticated user's email merged in server-side.

Frontend calls these via `apps/chat/src/server-api/footer.api.ts` using `base.ts` `post()` helper (endpoints are not yet in the generated OpenAPI client). Submission hooks (`useRequestApiKey`, `useReportIssue`) manage loading/error state. Success/error feedback uses `useNotification()` from `NotificationContext`.

**Rejected:** Direct client-to-Azure call — would expose function codes to the browser.

### D5 — Controlled React inputs with per-field error state; no form library

Two dialogs, eight fields total. Each dialog uses `useState` for field values and `fieldErrors: Record<string, string>` for inline error messages. Validation runs on submit; individual field errors clear on `onChange`.

### D6 — `%%VERSION%%` token kept; no separate `FOOTER_VERSION` env var

The app always has a `package.json` version, making a separate env var redundant. The token is replaced with `packageJSON.version` server-side before sanitization.

## Risks / Trade-offs

- **`sanitize-html` allowlist may strip legitimate operator markup** (e.g., `<abbr>`, `<small>`). → Mitigation: allowlist documented; operators can request additions. The list lives in one constant.
- **DOMPurify requires `window`/`document`** — no SSR export. → Mitigation: import guarded with `typeof window !== 'undefined'`; the component only mounts in the browser anyway.
- **Missing Azure vars cause 500 on submit, not at startup.** → Mitigation: `EnvironmentVariables` class marks them optional with a startup warning log; the NestJS service throws `ServiceUnavailableException` (503) with a clear message when absent.

## Open Questions

- Should the `sanitize-html` allowlist be configurable via env var, or is a hard-coded list sufficient? (Assume hard-coded for now.)
