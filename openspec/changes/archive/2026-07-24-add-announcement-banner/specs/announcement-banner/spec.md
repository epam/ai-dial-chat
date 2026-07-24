## ADDED Requirements

### Requirement: Full-width announcement banner renders the operator message at the top of the app

The system SHALL render a full-width announcement banner pinned to the top of the application chrome (above the navigation sidebar, conversation panel, and main content) whenever an operator-configured message is available. The message text SHALL come from the app-config value `config.announcementHtml` exposed by the `app-config-context` capability. The banner SHALL span the entire viewport width, not only the main content column.

The banner SHALL render only when the app-config `status` is ready AND `announcementHtml` is a non-empty string AND the message has not been dismissed (see content-keyed dismissal requirement). Otherwise the system SHALL render nothing (no empty banner element, no reserved vertical space).

#### Scenario: Banner shown when a message is configured

- **WHEN** app-config is ready and `config.announcementHtml` is a non-empty string that the user has not dismissed
- **THEN** a full-width banner is rendered at the top of the app chrome containing the message and a close control

#### Scenario: No banner when the message is empty or null

- **WHEN** `config.announcementHtml` is `null` or an empty string
- **THEN** no banner element is rendered and no vertical space is reserved for it

#### Scenario: No banner before config is ready

- **WHEN** app-config `status` is loading or error
- **THEN** no banner is rendered

#### Scenario: Banner spans the full width above the chrome

- **WHEN** the banner is visible
- **THEN** it appears above the navigation sidebar, conversation panel, and main content, and the remaining app chrome fills the space below it without layout or scroll regressions

### Requirement: Banner content is sanitized before rendering

The system SHALL sanitize the operator-supplied HTML message before rendering it as markup. Sanitization SHALL run in the application layer (not in the presentational library component) and SHALL allow only a safe subset of tags (`a`, `b`, `strong`, `em`, `br`, `span`) and attributes (`href`, `target`, `rel`). The presentational component SHALL receive already-sanitized HTML and SHALL NOT itself perform sanitization or hold sanitization policy.

#### Scenario: Safe formatting and links are preserved

- **WHEN** the message is `Welcome to <a href="https://dialx.ai" target="_blank" rel="noopener">DIAL</a>! <strong>Enjoy.</strong>`
- **THEN** the rendered banner shows the text with a working link and bold emphasis intact

#### Scenario: Script and inline event handlers are stripped

- **WHEN** the message contains `<script>…</script>` or an element with an inline handler such as `<img src=x onerror="alert(1)">`
- **THEN** the executable content is removed and no script or handler runs

#### Scenario: javascript: URLs are neutralized

- **WHEN** the message contains `<a href="javascript:alert(1)">x</a>`
- **THEN** the rendered link does not carry an executable `javascript:` URL

### Requirement: Dismissal is content-keyed and persisted in browser storage

The system SHALL provide a close control on the banner. Dismissing SHALL persist the exact dismissed message text to browser `localStorage` under the `TextOfClosedAnnouncement` storage key. The banner SHALL remain hidden only while the currently-configured message equals the stored dismissed text; if the operator changes the message text, the banner SHALL become visible again automatically without requiring a stored version counter or manual reset.

#### Scenario: Closing hides the banner and persists the dismissed text

- **WHEN** the user clicks the banner close control
- **THEN** the banner is hidden AND the current message text is written to `localStorage["textOfClosedAnnouncement"]`

#### Scenario: Dismissal survives reload for the same message

- **WHEN** the user has dismissed a message and reloads the app while the configured message is unchanged
- **THEN** the banner remains hidden

#### Scenario: Changing the message re-shows the banner

- **WHEN** a user has dismissed a message and the operator later changes `ANNOUNCEMENT_HTML_MESSAGE` to different text
- **THEN** the banner is shown again on next load because the stored dismissed text no longer equals the current message

### Requirement: Banner component is a single app-local component

The system SHALL implement the banner entirely within `apps/chat` as a single component that reads app config, browser storage, and i18n directly and renders the sanitized message. The banner SHALL NOT be exported from `libs/chat-shared` or any other shared library, since it has a single consumer and no cross-app reuse requirement.

#### Scenario: Component renders from app config without a shared-library dependency

- **WHEN** the app-local component reads a non-empty, non-dismissed `announcementHtml` from `useAppConfig()`
- **THEN** it renders the sanitized content and invokes dismissal on close, with no `libs/chat-shared` presentational shell involved

### Requirement: Banner is accessible and RTL-correct

The banner SHALL meet WCAG 2.1 AAA expectations: the banner root SHALL be a named region (`role="region"` with an `aria-label`), the close control SHALL carry an i18n-driven `aria-label`, and any decorative leading icon SHALL be `aria-hidden`. Directional styling SHALL use logical properties so the close control and layout flip correctly under `dir="rtl"`.

#### Scenario: Screen reader can identify and dismiss the banner

- **WHEN** a screen-reader user navigates to the banner
- **THEN** the banner is announced as a labeled region and the close control exposes a descriptive accessible name

#### Scenario: Layout mirrors in RTL

- **WHEN** the active direction is `rtl`
- **THEN** the close control and inline layout are mirrored via logical properties (no hardcoded left/right offsets)
