## ADDED Requirements

### Requirement: Full-width announcement banner renders the operator message at the top of the app

The system SHALL render a full-width announcement banner pinned to the top of the application chrome (above the navigation sidebar, conversation panel, and main content) whenever operator-configured content is available. The banner content SHALL come from the app-config values `config.announcementTitle`, `config.announcementDescription`, and `config.announcementHtml` exposed by the `app-config-context` capability. The banner SHALL span the entire viewport width, not only the main content column.

The banner SHALL render only when the app-config `status` is ready AND the announcement has content AND that content has not been dismissed (see content-keyed dismissal requirement). The announcement has content when at least one of `announcementTitle`, `announcementDescription`, or `announcementHtml` is a non-empty string. Otherwise the system SHALL render nothing (no empty banner element, no reserved vertical space).

#### Scenario: Banner shown when structured content is configured

- **WHEN** app-config is ready and `config.announcementTitle` is a non-empty string that the user has not dismissed
- **THEN** a full-width banner is rendered at the top of the app chrome containing the announcement content and a close control

#### Scenario: Banner shown when only the legacy message is configured

- **WHEN** app-config is ready, the title and description are empty, and `config.announcementHtml` is a non-empty string that the user has not dismissed
- **THEN** a full-width banner is rendered at the top of the app chrome containing the message and a close control

#### Scenario: No banner when every announcement field is empty

- **WHEN** `config.announcementTitle`, `config.announcementDescription`, and `config.announcementHtml` are all `null` or empty
- **THEN** no banner element is rendered and no vertical space is reserved for it

#### Scenario: No banner before config is ready

- **WHEN** app-config `status` is loading or error
- **THEN** no banner is rendered

#### Scenario: Banner spans the full width above the chrome

- **WHEN** the banner is visible
- **THEN** it appears above the navigation sidebar, conversation panel, and main content, and the remaining app chrome fills the space below it without layout or scroll regressions

---

### Requirement: Banner content is sanitized before rendering

The system SHALL sanitize operator-supplied HTML before rendering it as markup. This applies to both `config.announcementDescription` and the legacy `config.announcementHtml`. Sanitization SHALL run in the application layer (not in a presentational library component) and SHALL allow only a safe subset of tags (`a`, `b`, `strong`, `em`, `br`, `span`) and attributes (`href`, `target`, `rel`). This client-side pass SHALL remain in place even though the backend also sanitizes the description, so the component is safe regardless of which backend version serves it.

`config.announcementTitle` SHALL be rendered as a text node — never via `dangerouslySetInnerHTML` — so any markup an operator puts in the title is displayed literally rather than interpreted.

#### Scenario: Safe formatting and links are preserved in the description

- **WHEN** the description is `Explore our <a href="https://dialx.ai" target="_blank" rel="noopener">AI offerings</a>. <strong>Enjoy.</strong>`
- **THEN** the rendered banner shows the text with a working link and bold emphasis intact

#### Scenario: Script and inline event handlers are stripped

- **WHEN** the description or the legacy message contains `<script>…</script>` or an element with an inline handler such as `<img src=x onerror="alert(1)">`
- **THEN** the executable content is removed and no script or handler runs

#### Scenario: javascript: URLs are neutralized

- **WHEN** the description or the legacy message contains `<a href="javascript:alert(1)">x</a>`
- **THEN** the rendered link does not carry an executable `javascript:` URL

#### Scenario: Title markup is displayed literally

- **WHEN** `config.announcementTitle` is `Release <b>3.0</b>`
- **THEN** the banner displays the literal text `Release <b>3.0</b>` and renders no `<b>` element

---

### Requirement: Dismissal is content-keyed and persisted in browser storage

The system SHALL provide a close control on the banner. Dismissing SHALL persist a signature of the currently-displayed announcement to browser `localStorage` under the `TextOfClosedAnnouncement` storage key. The banner SHALL remain hidden only while the signature of the currently-configured announcement equals the stored value; if the operator changes the title, the description, or the legacy message, the banner SHALL become visible again automatically without requiring a stored version counter or manual reset.

Dismissal SHALL be persistent, not session-scoped: a dismissed announcement SHALL stay hidden across browser restarts for as long as its content is unchanged.

The signature SHALL be computed by a shared helper in `apps/chat/src/utils/` and SHALL be deterministic for a given announcement payload. When the announcement consists only of the legacy `announcementHtml` (no title, no description), the signature SHALL be exactly that HTML string, so dismissals recorded before the structured fields existed remain valid without a storage migration.

#### Scenario: Closing hides the banner and persists the signature

- **WHEN** the user clicks the banner close control
- **THEN** the banner is hidden AND the current announcement's signature is written to `localStorage["textOfClosedAnnouncement"]`

#### Scenario: Dismissal survives reload for the same announcement

- **WHEN** the user has dismissed an announcement and reloads the app while every configured announcement field is unchanged
- **THEN** the banner remains hidden

#### Scenario: Dismissal survives a browser restart

- **WHEN** the user has dismissed an announcement, closes the browser entirely, and reopens the app with the announcement unchanged
- **THEN** the banner remains hidden, because dismissal is persistent rather than session-scoped

#### Scenario: Changing the title or description re-shows the banner

- **WHEN** a user has dismissed an announcement and the operator later changes `ANNOUNCEMENT_TITLE` or `ANNOUNCEMENT_DESCRIPTION`
- **THEN** the banner is shown again on next load because the stored signature no longer equals the current one

#### Scenario: Changing the legacy message re-shows the banner

- **WHEN** a user has dismissed a legacy-only announcement and the operator later changes `ANNOUNCEMENT_HTML_MESSAGE` to different text
- **THEN** the banner is shown again on next load

#### Scenario: A pre-existing legacy dismissal survives the upgrade

- **WHEN** `localStorage["textOfClosedAnnouncement"]` holds a message string dismissed before the structured fields existed, and the deployment still configures only `ANNOUNCEMENT_HTML_MESSAGE` with that same string
- **THEN** the banner stays hidden after the upgrade, with no storage migration performed

---

### Requirement: Banner component is a single app-local component

The system SHALL implement the banner entirely within `apps/chat` as a single component that reads app config, browser storage, and i18n directly and renders the sanitized message. The banner SHALL NOT be exported from `libs/chat-shared` or any other shared library, since it has a single consumer and no cross-app reuse requirement.

#### Scenario: Component renders from app config without a shared-library dependency

- **WHEN** the app-local component reads a non-empty, non-dismissed `announcementHtml` from `useAppConfig()`
- **THEN** it renders the sanitized content and invokes dismissal on close, with no `libs/chat-shared` presentational shell involved

---

### Requirement: Banner is accessible and RTL-correct

The banner SHALL meet WCAG 2.1 AAA expectations:

- The banner root SHALL be a named region (`role="region"` with an `aria-label`). When a title is configured, the region's accessible name SHALL reference the title so a screen-reader user hears what the announcement is about rather than a generic label.
- The title SHALL be emphasized visually rather than marked up as a heading. It is a fragment of a single running line, not a section label, so the system SHALL NOT introduce a heading element for it and SHALL NOT add an entry to the document outline.
- Text that is visually truncated SHALL remain fully present in the DOM so assistive technology reads the complete string. The system SHALL NOT truncate by slicing the string in JavaScript.
- The close control SHALL carry an i18n-driven `aria-label`.
- Any decorative leading icon SHALL be `aria-hidden`.
- Every user-visible `aria-label` SHALL come from `t()` with a key declared in `apps/chat/src/constants/translation-keys.ts`; no hardcoded English strings.
- Both the title and the description SHALL meet AAA contrast (7:1 for normal-size text) against the banner surface. The description SHALL NOT use a muted secondary text token that fails that threshold.
- Directional styling SHALL use logical properties so the text alignment and the close control flip correctly under `dir="rtl"`.

#### Scenario: Screen reader can identify and dismiss the banner

- **WHEN** a screen-reader user navigates to the banner
- **THEN** the banner is announced as a labeled region and the close control exposes a descriptive accessible name

#### Scenario: The region name reflects the configured title

- **WHEN** `config.announcementTitle` is `🎉 Welcome to DIAL! 🎉` and a screen-reader user reaches the banner region
- **THEN** the announced region name conveys that title rather than only the generic word "Announcement"

#### Scenario: The title does not create a heading

- **WHEN** the banner renders with a configured title
- **THEN** no heading element is added to the document for it, and the page's existing heading outline is unchanged

#### Scenario: Truncated text is still announced in full

- **WHEN** the title and description are long enough to be visually truncated with an ellipsis
- **THEN** the complete text is present in the DOM and read in full by assistive technology

#### Scenario: Layout mirrors in RTL

- **WHEN** the active direction is `rtl`
- **THEN** the text runs from the right edge and the close control sits at the visual left, mirrored via logical properties (no hardcoded left/right offsets)

---

### Requirement: Structured banner line renders the title followed by the description

When the announcement has structured content — a non-empty `announcementTitle` or a non-empty `announcementDescription` — the banner SHALL render them as one start-aligned line: the title first, visually emphasized, followed by the description in normal weight, with the close control at the trailing edge. This replaces the legacy centered layout for structured content.

Each part SHALL be conditional: an unset title or description SHALL render no element at all, with no reserved space and no empty wrapper. When both are present the title SHALL precede the description.

When structured content is present, the legacy `announcementHtml` SHALL be ignored rather than appended.

#### Scenario: Title and description both configured

- **WHEN** the title is `🎉 Welcome to DIAL! 🎉` and the description is `Explore our AI offerings with your data.`
- **THEN** the banner renders the title in emphasized styling followed by the description in normal weight on one start-aligned line, with the close control at the trailing edge

#### Scenario: Title without description

- **WHEN** only `config.announcementTitle` is configured
- **THEN** the banner renders the title and the close control, and no description element or empty description wrapper is present in the DOM

#### Scenario: Description without title

- **WHEN** only `config.announcementDescription` is configured
- **THEN** the banner renders the description and the close control, and no title element is present in the DOM

#### Scenario: Content is start-aligned, not centered

- **WHEN** the structured banner renders on a viewport wide enough that the text does not fill the bar
- **THEN** the text begins at the leading edge of the banner rather than being centered

#### Scenario: Structured content takes precedence over the legacy message

- **WHEN** `config.announcementTitle` and `config.announcementHtml` are both non-empty
- **THEN** the banner renders the structured line and the legacy message text does not appear anywhere in the banner

---

### Requirement: Overflowing banner text is truncated with an ellipsis

When the combined title and description exceed the width available on the banner line, the system SHALL truncate the text with a trailing ellipsis rather than wrapping onto additional lines, growing the banner's height, or causing horizontal overflow.

Truncation SHALL be achieved with CSS text-overflow on the text container, leaving the full text in the DOM. The close control SHALL sit outside the truncating container and SHALL NEVER be clipped, pushed out of view, or made unreachable by long text.

#### Scenario: Long text truncates on one line

- **WHEN** the title and description together are longer than the available width
- **THEN** the visible text ends with an ellipsis, the banner keeps its single-line height, and the page does not scroll horizontally

#### Scenario: Short text is not truncated

- **WHEN** the title and description fit within the available width
- **THEN** the full text is displayed with no ellipsis

#### Scenario: The close control survives overflow

- **WHEN** the text is long enough to truncate
- **THEN** the close control remains fully visible at the trailing edge and remains clickable and keyboard-reachable

#### Scenario: A long title consumes the shared line

- **WHEN** the title alone exceeds the available width
- **THEN** the title truncates with an ellipsis and the description is pushed out of view without breaking the layout or the close control

---

### Requirement: Legacy single-line layout remains the fallback

When the announcement has no structured content and `config.announcementHtml` is a non-empty string, the banner SHALL render the centered single-line layout: the sanitized message centered, with the close control at the trailing edge.

The layout's **structure and behavior** are the contract — centered text, one line, dismissible, no title/description split, no announcements pill. Its **surface styling is not**: the legacy branch shares the redesigned banner's background, border, text, and close-control treatment rather than preserving the pre-redesign gradient, leading megaphone icon, and `CloseButton`. A legacy-only deployment therefore keeps its message and its behavior across the upgrade, but adopts the new visual language along with the rest of the application.

#### Scenario: Legacy-only deployment keeps its layout and behavior after upgrade

- **WHEN** a deployment configures only `ANNOUNCEMENT_HTML_MESSAGE` and upgrades to a build that supports the structured fields
- **THEN** the banner still renders the message centered on a single dismissible line, with no title/description split and no announcements pill

#### Scenario: The legacy branch adopts the redesigned surface

- **WHEN** the legacy layout renders after the upgrade
- **THEN** it uses the same background, border, text, and close-control treatment as the structured layout, rather than the pre-redesign gradient and leading megaphone icon

#### Scenario: Setting a structured field switches layouts

- **WHEN** an operator adds `ANNOUNCEMENT_TITLE` to a deployment that previously configured only `ANNOUNCEMENT_HTML_MESSAGE`
- **THEN** the banner switches to the start-aligned structured line on the next config load, with no additional feature flag required

---

### Requirement: Banner layout is mobile-first and responsive

The banner SHALL be usable on narrow viewports without horizontal overflow, without clipping the close control, and without growing beyond its single-line height. Truncation SHALL apply at every viewport width. Any JavaScript branching on viewport size SHALL use `useBreakpoint`/`useIsMobile` rather than reading `window.innerWidth`. Only the project's named Tailwind breakpoints (`mobile`, `desktop`) SHALL be used.

#### Scenario: Mobile layout truncates without overflow

- **WHEN** the banner renders a title and description at a mobile viewport width
- **THEN** the text truncates with an ellipsis, the close control stays visible at the trailing edge with a touch-sized target, and the page does not scroll horizontally

#### Scenario: Desktop layout shows more text

- **WHEN** the same banner renders at a desktop viewport width
- **THEN** more of the title and description is visible before truncation, on the same single line
