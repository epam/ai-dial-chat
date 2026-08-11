## Context

The banner line already ships: title + description, start-aligned, CSS-truncated, close control at the trailing edge, content-keyed persistent dismissal. This change adds the second half of the Figma frame — a `+N announcements` pill and the popover it opens.

The banner's config pipeline is the template: env var → `CONFIG_DEFINITIONS` entry → resolved and sanitized in `AppConfigService` → defaulted field on `ClientConfigResponseDto` → `AppConfigContext` → component. `html-sanitizer.ts` already exports `sanitizeAnnouncementHtml` with the exact allowlist the client mirrors, so per-row descriptions reuse it unchanged.

## Goals / Non-Goals

**Goals:**

- `ANNOUNCEMENTS` end to end with fail-soft per-entry validation.
- A pill in the banner showing the count, and a popover listing the announcements.
- Rows that navigate via real anchors, keyboard-operable, closing on re-click / outside click / `Escape`.
- RTL-correct and AAA-accessible by construction.

**Non-Goals:**

- Read/unread state or per-announcement dismissal. The counter is the number of configured announcements.
- Pagination, search, or filtering inside the popover.
- Resolving the dismissal tension in the proposal.
- Action links in the banner line itself — the design has none.

## Decisions

### 1. One `ANNOUNCEMENTS` JSON array, unlike the banner's two scalars

The banner's title and description are separate plain strings because operators edit that prose constantly and JSON escaping is a footgun. A *list* has no scalar form — entry count is variable and each entry has three or four fields — so `ANNOUNCEMENTS` is a single JSON array, matching the `CUSTOM_VISUALIZERS` precedent.

*Alternative considered:* indexed scalars (`ANNOUNCEMENT_1_TITLE`, …). Rejected — unbounded variable sprawl and no clean way to express "no third announcement".

### 2. `link` stays nested, not flattened

`{ link: { label, href } }` rather than `{ linkLabel, linkHref }`. One extra Swagger DTO class, but the operator-facing JSON reads the way the design reads, and a future second link per row is an array swap rather than a rename. Validation is hand-rolled and fail-soft, so `class-validator` nesting decorators are not load-bearing — the DTOs exist for Swagger and the generated client.

### 3. The link is optional; the title is not

A row with no link is legitimate (purely informational). A row with no title is not — it would render as an anonymous blob. So a blank/missing `title` drops the entry; a missing `link` keeps it and renders no anchor; a **malformed** link (present but blank label or non-`http(s)` href) drops the whole entry.

That asymmetry is deliberate: silently dropping a link an operator wrote is worse than dropping the row, because the row still looks correct and nobody notices the missing call to action.

### 4. Per-row descriptions reuse the banner's sanitizer unchanged

`sanitizeAnnouncementHtml` from `html-sanitizer.ts` — same allowlist, same forced `target="_blank"` + `rel="noopener noreferrer"`. A description that sanitizes to nothing becomes `null` and the row renders title + link only. Titles and link labels are plain text, never markup.

### 5. Built on the ui-kit `Dropdown`, not a hand-rolled popover

`Dropdown` with `renderOverlay` gives click-to-toggle, outside-press close, Floating UI placement, and portal rendering. Hand-rolling those is how outside-click bugs ship. Configured `placement="bottom-end"`, `matchReferenceWidth={false}` (the pill is far narrower than the list), and `maxDropdownHeight` to bound it.

Open state is lifted into the component (`open` + `onOpenChange`) rather than left uncontrolled, because the pill needs `aria-expanded` to reflect it.

### 6. The pill is the ui-kit `NeutralButton`, with ARIA passed through

The pill uses `NeutralButton` from `@epam/ai-dial-ui-kit` rather than an app-styled `<button>`, so it inherits the design system's button sizing, states, and focus treatment instead of re-deriving them locally.

That works only because the ui-kit `Button` family extends `DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, …>`: `aria-expanded`, `aria-haspopup`, `aria-controls`, and `id` pass straight through to the rendered `<button>`. Adopting the component does **not** license dropping them — a trigger without `aria-expanded` is a button whose state is invisible to assistive technology, and that requirement is independent of which component renders it.

### 7. `Escape` is handled on `document`, and focus is restored by id

The overlay renders in a portal, so a wrapper `div` is not a reliable place to catch the key event — and giving a `div` an `onKeyDown` trips `jsx-a11y/no-static-element-interactions`, correctly: a plain container should not be an interaction target.

So a `useEffect` binds a `keydown` listener on `document` only while the popover is open, and unbinds on close. It also restores focus to the pill, which Floating UI does not do for a trigger it does not own — without that, `Escape` closes the panel and drops the keyboard user at the top of the document.

Focus restoration looks the pill up by `id` rather than holding a `ref`. Whether a ui-kit component forwards a ref to its underlying `<button>` is that component's implementation detail; depending on it makes focus silently stop working the moment the pill is swapped for a different ui-kit button. An `id` from `useId()` is a contract the component controls.

The corresponding test must move focus *into* the popover before pressing `Escape`. Otherwise the pill still holds focus from the opening click and the assertion passes even when nothing restores it — a test that cannot fail is worse than no test.

### 8. Rows navigate via anchors, not ui-kit buttons

Every ui-kit `Button` variant extends `ButtonHTMLAttributes<HTMLButtonElement>` and renders a real `<button>`; none accepts `href` or `as`. A row link navigates, so it must be an `<a>`: screen readers announce "link", and middle-click / open-in-new-tab work. Styled at the app layer.

Same ui-kit gap the previous change flagged — worth raising upstream rather than solving twice in `apps/chat`.

### 9. The pill renders only when there is something to show

No valid announcements → no pill, no popover, no reserved space. A deployment that configures only the banner is unaffected by this change.

### 10. Accessibility

- The pill is a `<button>` with `aria-expanded`, `aria-haspopup`, and `aria-controls` pointing at the overlay's `useId()` id.
- Its accessible name is a full i18n phrase with the count, pluralized via i18next `_one`/`_other` — not a bare `+4`, which reads as nothing useful out of context.
- The overlay is a labeled `<section>` containing a `<ul>`, one `<li>` per announcement, so assistive tech announces the list and its length.
- Row titles are text, not headings — the popover is a list, and per-row `<h*>` would litter the document outline.
- Row links carry a visually-hidden "(opens in a new tab)" suffix.
- Spacing is logical throughout, and `placement="bottom-end"` resolves against writing direction, so RTL needs no override.

## Risks / Trade-offs

- **Dismissing the banner hides announcements permanently** under persistent dismissal. → Documented as the proposal's open question with three resolutions.
- **A long list overflows the viewport.** → `maxDropdownHeight` caps the overlay and it scrolls internally; the 10-entry cap bounds it further.
- **Malformed JSON produces no pill with no UI feedback.** → A specific `logger.warn` per rejected entry, documented as log-only in the deployment docs.
- **Row descriptions use `text-secondary` (~6.2:1), below the AAA 7:1 this repo targets.** → Deliberate: titles and links carry the meaning and the action, so descriptions read as muted supporting text, and they still clear AA. Recorded in the capability spec so it reads as a decision rather than an oversight, with an explicit note not to treat it as precedent for content text elsewhere. Revisit against the Figma tokens once the connector is authorized.
- **The pill crowds the banner line on mobile.** → The pill is `shrink-0` so the text truncates around it rather than the pill wrapping; the mobile presentation still needs the Figma pass.
- **Figma unread**, so popover width, row spacing, separators, and pill styling are reconstructed from screenshots. → Structure and behavior are pinned and independent of the tokens.

## Migration Plan

1. Additive on both sides: new registry entry, new DTO field defaulting to `[]`, new context field defaulting to `[]`.
2. Older frontend against newer backend ignores `announcements`; newer frontend against older backend gets `[]` and renders no pill. Deploy order does not matter.
3. Regenerate OpenAPI and rebuild `chat-api-client` in the same change.
4. **Rollback:** unset `ANNOUNCEMENTS`. The pill disappears; the banner is unaffected.

## Open Questions

- **Figma reconciliation:** popover width, row spacing and separators, pill styling and count format, mobile presentation, whether rows show an icon.
- **Entry cap:** implemented as 10. The design shows 4; confirm the intended ceiling.
- **Dismissal interaction:** see the proposal's open question — product's call.
- **Does the pill belong in the banner at all**, given the dismissal tension, or should it live in persistent app chrome?
