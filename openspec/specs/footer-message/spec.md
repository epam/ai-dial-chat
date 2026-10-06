# footer-message Specification

## Purpose
Show users operator-supplied, sanitized HTML information (and the version label) in the chat footer.

## Requirements
### Requirement: Operator-supplied footer HTML is sanitized server-side before use

The NestJS `app-config` module SHALL resolve the `footer.html` config-registry key (sourced from
`FOOTER_HTML_MESSAGE`, default `null`) and map it to `footerHtmlMessage` in
`apps/chat-api/src/app-config/client-config.mapper.ts` through `sanitizeFooterHtml`
(`apps/chat-api/src/app-config/html-sanitizer.ts`), which replaces every
`%%VERSION%%` token with the **resolved chat version** — `resolveAppVersion`
(`apps/chat-api/src/common/utils/app-version.ts`): the `app.version` key (`CHAT_VERSION`) when set
and non-blank, otherwise the workspace-root `package.json` version (`PACKAGE_VERSION`) — then
sanitizes the result using `sanitize-html` with an allowlist of `a`, `span`, `strong`, `u`, `em`, `br`, `p` tags. All other
tags and event-handler attributes SHALL be stripped; only `href`, `target` and `rel` survive, on
`<a>`. Every `<a>` tag SHALL have
`target="_blank"` and `rel="noopener noreferrer"` injected automatically, except for in-page
hash links (`href` starting with `#`), which are left untouched. The sanitized value SHALL be
included in the `GET /api/v1/app-config` response as the `footerHtmlMessage` field. The frontend
reads it via `useAppConfig().config.footerHtmlMessage`.

The token and the dedicated `config.appVersion` field SHALL always resolve to the same string,
so a footer authored with `%%VERSION%%` can never disagree with the version label.

- **i18n keys**: none for the message content (operator-supplied HTML, not translated); the
  region and version label use `footerMessage.regionAriaLabel` (`"Footer"`) and
  `footerMessage.versionAriaLabel` (`"Application version {{version}}"`) via
  `FooterMessageI18nKeys`
- **Feature flag**: `footer` (registry key `features.footer`, default `false`, resolved to `true`
  whenever `FOOTER_HTML_MESSAGE` is set) — checked via `useFeatureFlag('footer')` from
  `AppConfigContext`
- **RTL impact**: none — content is operator HTML; the wrapper element uses logical padding
- **Memoisation**: none required — value is static after app-config loads

#### Scenario: Version token substitution

- **WHEN** `FOOTER_HTML_MESSAGE` contains `%%VERSION%%` and `CHAT_VERSION` is not set
- **THEN** the server replaces it with the workspace-root `package.json` version (e.g. `"1.2.3"`)
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

The `FooterMessage` component (`apps/chat/src/components/FooterMessage/FooterMessage.tsx`) SHALL pass `footerHtmlMessage` through `sanitizeFooterHtml` from `@epam/ai-dial-chat-hooks` (`libs/chat-hooks/src/conversation/footer-message.ts`) — a DOMPurify pass with the same `a`/`span`/`strong`/`u`/`em`/`br`/`p` tag allowlist and `href`/`target`/`rel` attribute allowlist as the server — immediately before passing it to `dangerouslySetInnerHTML`. The sanitizer is only invoked when the `footer` flag is on and the message is non-empty; otherwise the sanitized value is `''`.

- **Memoisation**: `useMemo` on the sanitized result, keyed on `isFooterEnabled` and `footerHtmlMessage`

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
render containing only that label. The version label is not gated by the `footer` flag; an
embedding host hides it with the `hide-footer-version` UI feature (`OverlayFeature.HideFooterVersion`).

While `useAppConfig().status` is not `UserConfigStatus.Ready`, the component SHALL render
`null` regardless of either input.

#### Scenario: Feature flag disabled with no version

- **WHEN** `features.footer` resolves to `false` (e.g. `FOOTER_HTML_MESSAGE` is unset) and `config.appVersion` is `''`
- **THEN** `FooterMessage` renders nothing

#### Scenario: Feature flag disabled with a version available

- **WHEN** `features.footer` resolves to `false` and `config.appVersion` is non-empty
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

`FooterMessage` SHALL render below the chat input area of `ConversationView` and
`NewConversationComposer` at every breakpoint, and additionally as the `footer` of the
`NavigationSheet` (the mobile navigation sheet opened from the header hamburger) rendered by
`apps/chat/src/components/Navigation/Navigation.tsx`. Each placement mounts its own
`FooterMessage` instance; no screen-size render guard selects between them.

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

- **WHEN** a conversation or the new-conversation composer is shown at any breakpoint
- **THEN** `FooterMessage` is visible below the chat input area

#### Scenario: Mobile placement

- **WHEN** the `NavigationSheet` is opened from the header hamburger on `mobile`
- **THEN** `FooterMessage` is visible as the sheet's footer

#### Scenario: Screen reader identifies footer region

- **WHEN** `FooterMessage` renders with a non-empty message or a version label
- **THEN** the root element is a `<section>` labelled by `footerMessage.regionAriaLabel`, and the
  version is announced through a screen-reader-only `footerMessage.versionAriaLabel` text while
  the visible `formatAppVersion` label is `aria-hidden`

#### Scenario: Message stays centred with a version label present

- **WHEN** both the sanitized footer message and the version label render
- **THEN** the message element remains centred against the region's full width and is not offset
  by the label

