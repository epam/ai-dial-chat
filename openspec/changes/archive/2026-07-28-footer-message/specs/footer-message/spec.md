## ADDED Requirements

### Requirement: Operator-supplied footer HTML is sanitized server-side before use

The NestJS `app-config` service SHALL read `FOOTER_HTML_MESSAGE` from `ConfigService`, replace the `%%VERSION%%` token with `packageJSON.version`, then sanitize the result using `sanitize-html` with an allowlist of `a`, `span`, `strong`, `u`, `em`, `br`, `p` tags. All other tags and event-handler attributes SHALL be stripped. Every `<a>` tag SHALL have `target="_blank"` and `rel="noopener noreferrer"` injected automatically. The sanitized value SHALL be included in the `GET /api/v1/app-config` response as the `footerHtmlMessage` field. The frontend reads it via `useAppConfig().config.footerHtmlMessage`.

- **i18n keys**: none (content is operator-supplied HTML, not translated)
- **Feature flag**: `footer` — checked via `useFeatureFlag('footer')` from `AppConfigContext`
- **RTL impact**: none — content is operator HTML; the wrapper element uses logical padding
- **Memoisation**: none required — value is static after app-config loads

#### Scenario: Version token substitution

- **WHEN** `FOOTER_HTML_MESSAGE` contains `%%VERSION%%`
- **THEN** the server replaces it with the value of `packageJSON.version` (e.g. `"1.2.3"`) before any sanitization

#### Scenario: Dangerous HTML stripped

- **WHEN** `FOOTER_HTML_MESSAGE` contains `<script>alert(1)</script>` or `onclick` attributes
- **THEN** the sanitized value contains neither the `<script>` tag nor the `onclick` attribute

#### Scenario: Anchor links get safe attributes

- **WHEN** `FOOTER_HTML_MESSAGE` contains `<a href="https://example.com">Link</a>`
- **THEN** the sanitized value contains `target="_blank"` and `rel="noopener noreferrer"` on the anchor

#### Scenario: Unset env var produces empty string

- **WHEN** `FOOTER_HTML_MESSAGE` is not set
- **THEN** `footerHtmlMessage` is an empty string and the footer renders nothing

---

### Requirement: Footer HTML is sanitized client-side before rendering

The `FooterMessage` component SHALL apply DOMPurify to `footerHtmlMessage` immediately before passing it to `dangerouslySetInnerHTML`. If `window` is unavailable (SSR context), the raw value SHALL be used unchanged (server-side pass already ran).

- **Memoisation**: `useMemo` on the DOMPurify result, keyed on `footerHtmlMessage`

#### Scenario: Client-side sanitization runs in browser

- **WHEN** the `FooterMessage` component renders in a browser environment
- **THEN** the HTML passed to `dangerouslySetInnerHTML` is the DOMPurify-cleaned value, not the raw store value

---

### Requirement: Footer message is hidden when feature flag is off or message is empty

The `FooterMessage` component SHALL render `null` when either `useFeatureFlag('footer')` returns `false` or `footerHtmlMessage` is an empty string.

#### Scenario: Feature flag disabled

- **WHEN** `footer` is absent from `ENABLED_FEATURES`
- **THEN** `FooterMessage` renders nothing regardless of the `FOOTER_HTML_MESSAGE` value

#### Scenario: Empty message

- **WHEN** `FOOTER_HTML_MESSAGE` is set but resolves to an empty string after sanitization
- **THEN** `FooterMessage` renders nothing

---

### Requirement: Footer message renders in both desktop and mobile layouts

On `desktop` breakpoint and wider, `FooterMessage` SHALL render inside the chat input footer area. On `mobile` breakpoint, it SHALL render inside the mobile user panel below a separator. Both placements use the same `FooterMessage` component instance, controlled by screen-size render guards.

- **RTL impact**: the footer container div uses `px-*` replaced with `ps-*`/`pe-*` and `text-center` (direction-agnostic, no change needed)

#### Scenario: Desktop placement

- **WHEN** viewport is at `desktop` breakpoint or wider
- **THEN** `FooterMessage` is visible below the chat input area

#### Scenario: Mobile placement

- **WHEN** viewport is at `mobile` breakpoint
- **THEN** `FooterMessage` is visible in the mobile user panel

---

### Requirement: Footer container delegates click events to `data-dial-action` links

The `FooterMessage` component SHALL attach a single `onClick` handler to its root element. When a click originates on or within an element carrying `data-dial-action`, the handler SHALL call `event.preventDefault()` and dispatch the corresponding dialog open action via a callback prop `onDialAction(action: string)`. Clicks on elements with no `data-dial-action` ancestor SHALL pass through normally.

#### Scenario: Dialog-trigger link clicked

- **WHEN** user clicks `<a data-dial-action="requestApiKey" href="#">…</a>` inside the footer
- **THEN** `event.preventDefault()` is called and `onDialAction("requestApiKey")` is invoked

#### Scenario: Regular link clicked

- **WHEN** user clicks `<a href="https://example.com">…</a>` with no `data-dial-action`
- **THEN** no `onDialAction` call is made and the default navigation proceeds

---

### Requirement: Footer message container is accessible

The footer container SHALL have `data-qa="footer-message"` for test targeting. The inner `<span>` receiving operator HTML SHALL carry `aria-label` describing it as footer content when the message is non-empty.

- **a11y**: `role="contentinfo"` on the outer wrapper (if not already within a `<footer>` landmark); `aria-label` on the content span

#### Scenario: Screen reader identifies footer region

- **WHEN** `FooterMessage` renders with a non-empty message
- **THEN** the root element exposes a landmark or labelled region recognizable to assistive technology
