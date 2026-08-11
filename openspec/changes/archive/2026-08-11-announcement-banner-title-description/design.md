## Context

The announcement banner is a thin vertical slice: one env var (`ANNOUNCEMENT_HTML_MESSAGE`) → one `config-registry` definition (`announcement.html`) → one `ClientConfigResponseDto` field (`announcementHtml`) → one `AppConfigContext` field → one app-local component that DOMPurify-sanitizes the string and renders it as a single centered line with an `×` control. Dismissal is content-keyed: the exact dismissed string is written to `localStorage["textOfClosedAnnouncement"]`, and the banner reappears whenever the operator changes the text.

The redesign (Figma `-DIAL- Components 2.0`, node `467-1097`) splits that line into a bold title followed by supporting description text, start-aligned rather than centered, with the close control at the trailing edge and an ellipsis when the text overruns the available width.

Constraints in play:

- **The description is untrusted operator input.** It is HTML authored in a Helm values file, so it needs server-side sanitization with fail-soft semantics.
- **Backwards compatibility is required.** Deployments configured only with `ANNOUNCEMENT_HTML_MESSAGE` must render exactly as they do today, and users who already dismissed that message must stay dismissed after the upgrade.
- **The Figma frame has been seen only as screenshots.** The connector was unauthorized when this was written, so the structure is known but the tokens are not.

## Goals / Non-Goals

**Goals:**

- Add `ANNOUNCEMENT_TITLE` and `ANNOUNCEMENT_DESCRIPTION` to the app-config pipeline end to end (env validation → registry → DTO → context → component).
- Render the structured banner line — bold title, then description, start-aligned, ellipsis on overflow — when either field is configured, and the current centered single-line layout when only the legacy field is.
- Extend dismissal to key on the whole banner payload without invalidating existing legacy-only dismissals.
- Keep the banner WCAG 2.1 AAA-correct and RTL-correct in the new layout.

**Non-Goals:**

- The announcements popover, its list configuration, and its read/unread semantics — see *Deferred* below.
- Action buttons or links of any kind in the banner line. The redesigned banner has none; its only interactive controls are the (deferred) announcements pill and the close control.
- Per-role, per-locale, or scheduled (start/end date) announcements.
- Rich content in the title (it stays plain text) or a wider HTML allowlist in the description.
- Moving the banner into `libs/*`. It stays a single app-local component in `apps/chat`, as the existing spec requires.
- Session-scoped dismissal (see decision 5).

## Decisions

### 1. Two separate env vars, not one JSON object

`ANNOUNCEMENT_TITLE` and `ANNOUNCEMENT_DESCRIPTION` are plain strings.

*Rationale:* operators edit banner prose often, and forcing every typo fix through JSON escaping is a real source of production breakage. It also mirrors how `ANNOUNCEMENT_HTML_MESSAGE` and `FOOTER_HTML_MESSAGE` already work, so there is one idiom for "operator-authored banner text" rather than two.

*Alternative considered:* a single `ANNOUNCEMENT_BANNER` JSON object. One registry entry instead of two and a truer model of "one announcement", but a malformed blob takes out the whole banner instead of one field. Rejected on operator ergonomics.

*Consequence:* two registry definitions that are semantically one object, resolved independently. Nothing enforces that they are set together, which is intentional — a title-only or description-only banner is valid.

### 2. Description is sanitized server-side; title is never HTML

`announcement.description` runs through a `sanitize-html` pass with the announcement allowlist (tags `a`, `b`, `strong`, `em`, `br`, `span`; attrs `href`, `target`, `rel`), with `target="_blank"` + `rel="noopener noreferrer"` forced on non-hash anchors. The title is rendered as a text node — no `dangerouslySetInnerHTML`, no sanitizer needed.

The allowlist is **not** the footer's. The footer permits `u` and `p` as well; the announcement is a single truncating line where block-level and underline markup make no sense, and — more importantly — the client-side DOMPurify pass already allows exactly `a`, `b`, `strong`, `em`, `br`, `span`. Reusing the footer's wider list would have the server return markup the client silently strips. The two sanitizers share the anchor transform and the attribute map, not the tag list.

The existing client-side DOMPurify pass in `AnnouncementBanner` stays for both the legacy message and the description. The `announcement-banner` spec explicitly requires app-layer sanitization, and keeping it makes the component safe regardless of which backend version serves it. Server-side sanitization is added defense-in-depth, not a replacement.

The footer's sanitizer gets extracted into a shared helper rather than having its allowlist duplicated, with the `%%VERSION%%` substitution left footer-specific.

*Alternative considered:* client-only sanitization (status quo for the announcement). Rejected — the footer already establishes the server-side pattern, and the API response is a public contract that should not ship raw operator HTML to any consumer.

### 3. Layout mode is chosen by content, not by a feature flag

The component computes `hasStructuredContent = !!(title || description)`. When true it renders the structured line; when false and the legacy message is present, it renders the centered single-line layout, structurally unchanged though restyled onto the redesigned surface; when neither, it renders nothing. Structured content wins over the legacy message rather than appending to it.

*Rationale:* operators upgrade by setting the new vars, with no second flag to flip and no window where both must be coordinated. Rollback is trivial — unset the new vars and the old layout returns.

*Alternative considered:* mapping the legacy message onto the description slot for a single code path. Simpler code, but it silently changes how every existing deployment's banner looks on upgrade — centered becomes start-aligned. Rejected: the point of keeping the fallback is that nothing visibly changes until an operator opts in.

*Trade-off:* two layout branches in one component for as long as the legacy var is supported. Contained by freezing the legacy branch (no refactors) so its tests stay meaningful, letting it be deleted in one commit when the var is retired.

### 4. Truncation is CSS, not JavaScript

The design truncates the banner line with an ellipsis when the text exceeds the available space. This is single-line text overflow, so it is `min-w-0` + `truncate` (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`) on the text container — no measurement, no `ResizeObserver`, no JS-side string slicing.

The title and description share one truncating line, so an over-long title can consume the description's space. That matches the design, which treats the pair as one sentence-like run. The close control sits outside the truncating container and never gets clipped.

*Consequence:* the full text is not recoverable from the banner when truncated. That is acceptable here because the banner is a teaser and the (deferred) popover is where the full text lives. If the popover ships and the banner still truncates, revisit whether the truncated line should be a `title`/tooltip surface.

*Alternative considered:* line-clamping to N lines instead of one. Rejected — the design shows a fixed-height single-line bar, and a growing banner pushes the app chrome around.

### 5. Dismissal stays persistent and content-keyed, against the Figma note

The Figma frame's annotation says the banner "appears once when the user first opens the browser. If closed, the banner is shown again the next time the browser is opened" — session-scoped dismissal. This change deliberately does **not** implement that.

*Rationale:* today's shipped behavior is persistent content-keyed `localStorage` dismissal. Switching to `sessionStorage` regresses every user who dismissed a banner expecting it gone, turns existing stored dismissals into dead data, and makes a long-lived announcement re-interrupt the same user every day. The Figma note plausibly describes prototype behavior rather than a product decision. Flagged here so it is a deliberate divergence, not an oversight — if product does want session-scoped dismissal, it is a small, isolated change to the hook.

*Alternative considered:* following the design literally. Rejected on the regression above. A middle option — session-scoped banner plus persistent per-item read state — only makes sense once the popover exists, so it belongs to the follow-up change if anywhere.

### 6. Dismissal keys on a payload signature, with legacy identity preserved

`useAnnouncementDismissal` keeps storing a single string under `StorageKey.TextOfClosedAnnouncement`. What changes is what gets stored: a deterministic signature of the whole payload, computed by a shared helper in `apps/chat/src/utils/`.

The signature is defined so that a legacy-only announcement produces **exactly the legacy HTML string** — the same value the current code writes. That is what makes existing dismissals survive the upgrade without a migration step. When either structured field is set, the signature is a stable serialization of `{ title, description }`, which changes whenever any part of the announcement changes.

*Alternative considered:* hashing the serialized payload. Shorter and collision-resistant, but needs a crypto call or a hand-rolled hash, is opaque when debugging `localStorage`, and would break the legacy-identity property. Rejected — the stored value is small and never leaves the browser.

*Alternative considered:* an operator-bumped `announcementVersion` counter. Rejected for the reason the original spec rejected it: it adds a step that gets forgotten, and content-keying is self-maintaining.

### 7. Accessibility and RTL contract for the new layout

- The banner root keeps `role="region"` with an i18n `aria-label`. When a title is configured, the region's accessible name references it, so a screen-reader user hears what the announcement is about rather than the generic word "Announcement".
- The title is emphasized **visually** (bold) but is not a heading element. It is a fragment of a single running line, not a section label introducing content — marking it `<h2>` would inject a meaningless entry into the document outline on every route. Weight comes from styling; meaning comes from the region's accessible name.
- Truncated text must remain fully available to assistive technology. CSS `text-overflow` clips visually but leaves the DOM text intact, so screen readers still read the whole string — do not switch to JS string-slicing, which would destroy it.
- The close control keeps its existing i18n `aria-label`; any decorative leading icon is `aria-hidden`.
- Every user-visible `aria-label` comes from `t()` with a key in `translation-keys.ts`.
- Direction: the line is start-aligned via `text-start` and logical spacing (`ms-*`/`me-*`, `ps-*`/`pe-*`, `start-*`/`end-*`), so the whole bar mirrors under `dir="rtl"` with the close control moving to the visual left. No `rtl:` overrides needed.
- Contrast: the banner bar is a dark surface in the design. Both the title and the description must clear AAA (7:1 normal text) against it — the description in particular, since it is rendered at a lighter weight and must not be given a muted secondary token.

### 8. Mobile

The design screenshots show only the desktop bar. The banner is mobile-first by default: the title/description line truncates on narrow viewports exactly as it does on wide ones, and the close control stays pinned to the trailing edge at a touch-sized target. Whether mobile stacks the title above the description or keeps them inline is an open question for the Figma pass; the single-line truncating behavior is the safe default until then. Any JS branching uses `useBreakpoint`/`useIsMobile`, never `window.innerWidth`, and only the `mobile`/`desktop` named breakpoints.

## Deferred: the announcements popover

Recorded here so the observed design is not lost. **Not in scope for this change.**

The same frame shows a `+N announcements` pill sitting between the description and the close control. Clicking it opens a panel anchored to the trailing edge listing announcements, each row carrying its own title, a short description, and a single trailing link (`Changelog`, `Register`). The annotation states the list closes when the user clicks the pill again or clicks anywhere outside it. The pill's counter reflects the number of announcements in the list, and the banner line itself is *not* one of them — the screenshot shows a `Welcome to DIAL` banner alongside four unrelated announcements.

Implications for whoever picks it up:

- Configuration is list-shaped: an `ANNOUNCEMENTS` JSON array of `{ title, description, link: { label, href } }`, needing the same fail-soft entry validation and `http`/`https`-only href allowlist this change applies to the description's anchors.
- Rendering each row's link raises a question this change dodged: every `Button` variant in `@epam/ai-dial-ui-kit` (`Button`, `PrimaryButton`, `LinkButton`, …) extends `ButtonHTMLAttributes<HTMLButtonElement>` and renders a real `<button>` — none accepts `href` or an `as` prop. Navigating rows need `<a>` elements styled at the app layer, and the missing anchor-capable button is worth raising against the ui-kit.
- The panel is a dismissible overlay: focus management, `Escape` to close, outside-click, and `aria-expanded`/`aria-controls` on the pill.
- Read/unread state is implied by the counter and is the natural place to reconsider session-scoped versus persistent semantics.

## Risks / Trade-offs

- **Diverging from the Figma dismissal note** could surprise a designer reviewing the built banner. → Called out in the proposal and here as a deliberate decision with rationale; raise it in design review rather than discovering it at QA.
- **A long title eats the description** on the shared truncating line. → Matches the design's treatment of the pair as one run; documented, and the operator controls both strings.
- **Truncation hides content with no affordance to reveal it.** → Acceptable while the banner is a teaser; revisit when the popover ships and there is somewhere for the full text to live.
- **Two layout branches drift over time**, with the legacy path rotting untested. → Both branches keep explicit test coverage, and the legacy branch's structure (centered, single line, no pill) is frozen until the var is retired — only its surface tokens follow the redesign.
- **Signature grows large** if an operator writes a long description, since it is stored verbatim in `localStorage`. → Bounded in practice; swapping to a hash later is a contained change to one helper, at the cost of the legacy-identity property.
- **Only screenshots of the Figma frame were available**, so spacing, colors, typography, and the mobile variant are unverified. → Structure and behavior are pinned; the visual pass is an explicit blocking task and cannot invalidate the data model or the accessibility contract.

## Migration Plan

1. Ship backend + frontend together. Both are additive: new registry entries, new nullable DTO fields, new context fields defaulting to `null`.
2. An older frontend against a newer backend ignores the new response fields. A newer frontend against an older backend sees them absent, falls back to `null`, computes `hasStructuredContent === false`, and renders the legacy layout. Both directions are safe, so deploy order does not matter.
3. Regenerate the OpenAPI artifacts (`npm run openapi`, `npm run openapi:check`) and rebuild `chat-api-client` in the same change.
4. Existing dismissals need no migration — a legacy-only announcement's signature is byte-identical to what is already stored.
5. **Rollback:** unset the two new env vars. The banner falls back to the legacy layout with no code change and no storage cleanup. A full code rollback is also safe, since the new fields are additive and the stored value for legacy-only announcements is unchanged.
6. Add both variables to the deployment documentation and the release notes' Deployment Changes section.

## Open Questions

- **Figma reconciliation (blocking for final styling, not for the data model):** exact spacing, colors, typography tokens, the leading icon, and the bar height in node `467-1097`. Requires an authorized `figma` connector.
- **Mobile variant:** does the frame stack the title above the description on narrow viewports, or keep the single truncating line? Default is the single line until confirmed.
- **Title/description separator:** the screenshot shows whitespace between the bold title and the description. Confirm whether the frame uses a fixed gap, a separator glyph, or relies on the title's trailing space.
- **Description length guidance:** whether the deployment docs should recommend a character budget, given that overflow is silently truncated.
- **Session-scoped dismissal:** confirm with product that persistent dismissal is intended and the Figma note describes prototype behavior (decision 5).
