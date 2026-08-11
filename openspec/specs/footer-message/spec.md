# footer-message Specification

## Purpose
Show user useful information in the footer.

## Requirements
### Requirement: Operator-supplied footer HTML is sanitized server-side before use

The NestJS `app-config` service SHALL read `FOOTER_HTML_MESSAGE` from `ConfigService`, replace
the `%%VERSION%%` token with the **resolved chat version** — the `CHAT_VERSION` env var when
set and non-blank, otherwise `packageJSON.version` — then sanitize the result using
`sanitize-html` with an allowlist of `a`, `span`, `strong`, `u`, `em`, `br`, `p` tags. All other
tags and event-handler attributes SHALL be stripped. Every `<a>` tag SHALL have
`target="_blank"` and `rel="noopener noreferrer"` injected automatically, except for in-page
hash links (`href` starting with `#`), which are left untouched. The sanitized value SHALL be
included in the `GET /api/v1/app-config` response as the `footerHtmlMessage` field. The frontend
reads it via `useAppConfig().config.footerHtmlMessage`.

The token and the dedicated `config.appVersion` field SHALL always resolve to the same string,
so a footer authored with `%%VERSION%%` can never disagree with the version label.

- **i18n keys**: none (content is operator-supplied HTML, not translated)
- **Feature flag**: `footer` — checked via `useFeatureFlag('footer')` from `AppConfigContext`
- **RTL impact**: none — content is operator HTML; the wrapper element uses logical padding
- **Memoisation**: none required — value is static after app-config loads

#### Scenario: Version token substitution

- **WHEN** `FOOTER_HTML_MESSAGE` contains `%%VERSION%%` and `CHAT_VERSION` is not set
- **THEN** the server replaces it with the value of `packageJSON.version` (e.g. `"1.2.3"`)
  before any sanitization

#### Scenario: Version token honours CHAT_VERSION

- **WHEN** `FOOTER_HTML_MESSAGE` contains `%%VERSION%%` and `CHAT_VERSION=2026.08.10-a1b2c3d`
  is set
- **THEN** the server replaces the token with `2026.08.10-a1b2c3d`, matching
  `config.appVersion` in the same response

#### Scenario: Dangerous HTML stripped

- **WHEN** `FOOTER_HTML_MESSAGE` contains `<script>alert(1)</script>` or `onclick` attributes
- **THEN** the sanitized value contains neither the `<script>` tag nor the `onclick` attribute

#### Scenario: Anchor links get safe attributes

- **WHEN** `FOOTER_HTML_MESSAGE` contains `<a href="https://example.com">Link</a>`
- **THEN** the sanitized value contains `target="_blank"` and `rel="noopener noreferrer"` on the
  anchor

#### Scenario: Unset env var produces empty string

- **WHEN** `FOOTER_HTML_MESSAGE` is not set
- **THEN** `footerHtmlMessage` is an empty string and no footer message content renders

---

### Requirement: Footer HTML is sanitized client-side before rendering

The `FooterMessage` component SHALL apply DOMPurify to `footerHtmlMessage` immediately before passing it to `dangerouslySetInnerHTML`. If `window` is unavailable (SSR context), the raw value SHALL be used unchanged (server-side pass already ran).

- **Memoisation**: `useMemo` on the DOMPurify result, keyed on `footerHtmlMessage`

#### Scenario: Client-side sanitization runs in browser

- **WHEN** the `FooterMessage` component renders in a browser environment
- **THEN** the HTML passed to `dangerouslySetInnerHTML` is the DOMPurify-cleaned value, not the raw store value

---

### Requirement: Footer message is hidden when feature flag is off or message is empty

The `FooterMessage` component SHALL NOT render the operator's footer HTML when either
`useFeatureFlag('footer')` returns `false` or `footerHtmlMessage` is an empty string.

The component SHALL render `null` only when it has nothing at all to show — that is, when the
footer message is hidden by the rule above **and** no version label is available (see the
`chat-version-display` capability). When a version label is available, the footer region SHALL
render containing only that label.

While `useAppConfig().status` is not `UserConfigStatus.Ready`, the component SHALL render
`null` regardless of either input.

#### Scenario: Feature flag disabled with no version

- **WHEN** `footer` is absent from `ENABLED_FEATURES` and `config.appVersion` is `''`
- **THEN** `FooterMessage` renders nothing regardless of the `FOOTER_HTML_MESSAGE` value

#### Scenario: Feature flag disabled with a version available

- **WHEN** `footer` is absent from `ENABLED_FEATURES` and `config.appVersion` is non-empty
- **THEN** `FooterMessage` renders the footer region containing the version label and none of
  the `FOOTER_HTML_MESSAGE` content

#### Scenario: Empty message with no version

- **WHEN** `FOOTER_HTML_MESSAGE` is set but resolves to an empty string after sanitization, and
  `config.appVersion` is `''`
- **THEN** `FooterMessage` renders nothing

#### Scenario: Config not ready

- **WHEN** `useAppConfig().status` is `UserConfigStatus.Loading` or `UserConfigStatus.Error`
- **THEN** `FooterMessage` renders nothing

---

### Requirement: Footer message renders in both desktop and mobile layouts

On `desktop` breakpoint and wider, `FooterMessage` SHALL render inside the chat input footer
area. On `mobile` breakpoint, it SHALL render inside the mobile user panel below a separator.
Both placements use the same `FooterMessage` component instance, controlled by screen-size
render guards.

The footer region SHALL be a positioning context (`relative`) whose direct children are the
sanitized-message element and the version label, rather than a single element hosting the
sanitized HTML. When both render, the message element keeps `text-center` across the region's
full width so its centring is unaffected by the label's presence or length, and the label is
absolutely positioned out of flow to achieve that. When the message does not render, the label
stays in normal flow, because a section with no in-flow child collapses to its own padding and
an out-of-flow label would paint outside it.

- **RTL impact**: the footer container uses logical inline padding (`ps-*`/`pe-*` or symmetric
  `px-*`) and `text-center` (direction-agnostic); the version label uses the logical `end-*`
  inset on an element that inherits page direction, so it pins to the correct corner in both
  directions — a `dir` attribute on that element would make the logical inset resolve against
  its own direction and defeat the flip

#### Scenario: Desktop placement

- **WHEN** viewport is at `desktop` breakpoint or wider
- **THEN** `FooterMessage` is visible below the chat input area

#### Scenario: Mobile placement

- **WHEN** viewport is at `mobile` breakpoint
- **THEN** `FooterMessage` is visible in the mobile user panel

#### Scenario: Screen reader identifies footer region

- **WHEN** `FooterMessage` renders with a non-empty message or a version label
- **THEN** the root element exposes a landmark or labelled region recognizable to assistive
  technology

#### Scenario: Message stays centred with a version label present

- **WHEN** both the sanitized footer message and the version label render
- **THEN** the message element remains centred against the region's full width and is not offset
  by the label

