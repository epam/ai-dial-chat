## Context

The original AI DIAL Chat (`development`) rendered a top-of-app announcement banner from `process.env.ANNOUNCEMENT_HTML_MESSAGE`, hydrated through Next.js `getServerSideProps` into a Redux `settings` slice, dismissed via a Redux/UI slice that persisted the closed text to `localStorage`. chat 2.0 (`development-1.0`) has none of that plumbing: it is a Vite SPA + NestJS backend, uses React Context (no Redux), and gets operator config through a purpose-built **app-config pipeline** (`GET /api/v1/client-config` → `AppConfigContext`). The library-isolation rule additionally forbids `libs/*` from touching env/config/storage/i18n.

This change rebuilds the banner against those primitives. It is deliberately modeled on the most recent precedent in the tree — the `dialCore.externalUrl` client-config value — which added a single string config through env → registry → service → DTO → generated client → `AppConfigContext`.

## Goals / Non-Goals

**Goals:**
- Operators can set one env var (`ANNOUNCEMENT_HTML_MESSAGE`) to show a global banner; empty/unset = off.
- Preserve the old app's defining UX: **content-keyed dismissal** — editing the message re-shows the banner automatically.
- Render operator HTML safely (sanitized), keeping the familiar HTML authoring format.
- RTL-correct and WCAG 2.1 AAA accessible.

**Non-Goals:**
- No role-gated feature flag (env var only, per issue triage).
- No per-user server-side dismissal state (dismissal is a browser-local preference).
- No themeable background image via CSS var (old `--chat-announcement-banner`) in this change — deferrable behind `buildCssVars` later.
- No Playwright/e2e suite (none exists in chat 2.0; coverage is Vitest component tests).
- No Markdown authoring (HTML retained).

## Decisions

### D1 — Source via the `config` path, not a `feature` flag
`announcement.html` is a non-boolean string, and the app-config `features` map only carries booleans (`app-config.service.ts` adds `type:'feature'` generically but `type:'config'` values each need an explicit branch). So it is a `type='config'`, `valueType='string'`, `visibility='client'`, `defaultValue=null` registry entry backed by `envVar='ANNOUNCEMENT_HTML_MESSAGE'`. No `env-config.provider.ts` change is needed — the generic string path resolves it. **Alternative considered:** a `features.announcementBanner` boolean toggle + separate text — rejected as over-engineered for a single message; empty text already means "off".

### D2 — Content-keyed dismissal via `localStorage`
Store the dismissed message text under `StorageKey.TextOfClosedAnnouncement`; show the banner iff `announcementHtml` is non-empty and `dismissedText !== announcementHtml`. This reproduces the old behavior exactly and needs no version field. **Alternative:** a boolean "dismissed" flag — rejected because it would keep the banner hidden after the operator changes the message, defeating the feature. Use the existing `useLocalStorage<string>` hook (synchronous `useState` seed → no flash-before-rehydrate, so the old `undefined` guard is unnecessary).

### D3 — Sanitize HTML in the app, render in the lib
DOMPurify (`3.4.11`, already a root dependency) sanitizes the message in the `apps/chat` container (allowlist: `a b strong em br span`; attrs `href target rel`) and passes a trusted `contentHtml` string to the lib, which renders it via `dangerouslySetInnerHTML`. This keeps the lib free of security policy and dependency knowledge while closing the XSS vectors CSP does not cover (inline `onerror`/`onload`, `javascript:` URLs). **Alternatives:** raw unsanitized HTML (old behavior — rejected, XSS risk); Markdown via existing `MarkdownRenderer` (safe, no dep — rejected only because it changes the operator authoring format from HTML).

### D4 — App-local component, no lib split
`AnnouncementBanner` lives entirely in `apps/chat/src/components/AnnouncementBanner/`: a single component reads `useAppConfig()`, runs dismissal + sanitization + i18n, and renders the markup directly. **Superseded decision:** an earlier iteration split this into a presentational shell in `libs/chat-shared` (mirroring the `StarterButtons` lib/app split) plus a thin app container, reasoning that any props-only component should follow the isolation-compliant pattern already used by `Highlight`/`PanelEmptyState`. On review, that reasoning didn't hold up: this banner has exactly one consumer (`apps/chat`, mounted once in `app.tsx` with zero prop variation), and `chat-shared`'s only other app (`apps/chat-overlay-sandbox`) doesn't consume it either — the "reusability" cited for the split was aspirational, not real. The lib boundary bought easier isolated testing of the render logic but nothing else, and it isn't worth the extra file/package-export indirection for a single-consumer component. **Alternative:** keep the lib shell — rejected as premature abstraction; most of `apps/chat`'s own UI (`Header`, `Navigation`, `ConversationPanel`, etc.) stays fully app-local without a lib split, and this component fits that majority pattern once the reuse premise is gone.

### D5 — Mount at the top of the whole chrome
`app.tsx`'s root is currently a horizontal flex row. Wrap it in an outer `flex-col` with `<AnnouncementBanner />` as the first child and the existing row as a `min-h-0 flex-1` second child, so the banner spans sidebar + panels + main. `App` is already inside `AppConfigProvider` (via `main.tsx`), so the container's `useAppConfig()` is valid. **Alternative:** insert only inside `<main>` above `<Header>` — rejected because the old banner spanned the full width, not just the content column.

### D6 — Styling with valid tokens
Use `text-controls-permanent` over a valid accent background token (e.g. `bg-accent-primary-fill`); the old `from-accent-secondary to-accent-tertiary` gradient stops do **not** exist in this `tailwind.config.js`. Close button uses logical `end-*` positioning (RTL), the speakerphone icon is `aria-hidden`, and the root is a named `role="region"`.

## Risks / Trade-offs

- **[Sanitizer over-strips legitimate markup]** → allowlist covers the realistic banner needs (links + basic emphasis + line breaks); widen deliberately if operators need more, never disable sanitization.
- **[OpenAPI client drift]** → after the DTO change, regenerating `@epam/chat-api-client` is mandatory; `npm run openapi:check` gates it in CI.
- **[Layout regression from wrapping the root]** → the inner row must get `min-h-0 flex-1` so existing height/scroll behavior is preserved; verify the chat area and panels still fill the viewport with and without the banner.
- **[Content-keyed dismissal surprises users on edit]** → intended behavior; documented so operators understand editing the text re-shows the banner for everyone.
- **[HTML string in `localStorage`]** → only the operator-controlled, already-sanitized text is stored and it is compared, never re-rendered from storage; no additional exposure.

## Migration Plan

Additive and backward-compatible. Deploy backend + regenerated client + frontend together. With `ANNOUNCEMENT_HTML_MESSAGE` unset (default `null`), nothing renders — zero behavior change until an operator opts in. Rollback = unset the env var (immediate hide) or revert the change; no data migration, and stored `textOfClosedAnnouncement` keys are harmless if left behind.

## Open Questions

None — trigger mechanism (env var only), rendering (sanitized HTML), and placement (single app-local component, no lib split) are decided.
