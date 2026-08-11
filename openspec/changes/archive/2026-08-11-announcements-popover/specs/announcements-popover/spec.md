## ADDED Requirements

### Requirement: A count pill in the banner opens the announcements popover

When at least one valid announcement is configured, the system SHALL render a pill control in the announcement banner, positioned between the banner text and the close control. The pill SHALL communicate the number of announcements. Activating it SHALL open a popover listing them; activating it again SHALL close the popover.

When no valid announcement is configured, the system SHALL render no pill, no popover, and no reserved space for either.

The pill SHALL NOT dismiss the banner, and the banner close control SHALL NOT open the popover.

#### Scenario: Pill shows the announcement count

- **WHEN** two valid announcements are configured
- **THEN** the banner renders a pill whose accessible name communicates that there are two announcements

#### Scenario: Pill opens and closes the popover

- **WHEN** the user activates the pill, then activates it again
- **THEN** the popover opens on the first activation and closes on the second

#### Scenario: No pill without announcements

- **WHEN** `config.announcements` is empty
- **THEN** no pill is rendered and the banner shows only the title, description, and close control

#### Scenario: No pill in the legacy banner layout

- **WHEN** only the legacy `announcementHtml` is configured, alongside configured announcements
- **THEN** the legacy centered layout renders unchanged, without a pill

---

### Requirement: The popover lists each announcement with its title, description, and link

The popover SHALL render one list item per announcement, in configured order. Each row SHALL render the announcement's title as text, its sanitized description when present, and its link when present.

A row's link SHALL be an anchor element carrying the configured `href`, `target="_blank"`, and `rel="noopener noreferrer"`, labeled with the configured link label.

Each part SHALL be conditional: an announcement without a description SHALL render no description element, and one without a link SHALL render no anchor — in both cases with no empty wrapper.

#### Scenario: A complete announcement renders all three parts

- **WHEN** an announcement has a title, a description, and a link labeled `Changelog`
- **THEN** the row renders the title, the description, and a `Changelog` anchor pointing at the configured URL with `target="_blank"` and `rel="noopener noreferrer"`

#### Scenario: An announcement without a link renders no anchor

- **WHEN** an announcement has a title but no link
- **THEN** the row renders the title and contains no anchor element

#### Scenario: An announcement without a description renders no description element

- **WHEN** an announcement has a title and a link but no description
- **THEN** the row renders the title and the link, with no empty description element in the DOM

#### Scenario: Rows keep configured order

- **WHEN** three announcements are configured
- **THEN** they render in the popover in the same order they appear in `config.announcements`

---

### Requirement: Announcement content is sanitized before rendering

The system SHALL sanitize each announcement description in the application layer before rendering it as markup, allowing only the announcement tag subset (`a`, `b`, `strong`, `em`, `br`, `span`) and attributes (`href`, `target`, `rel`) — the same policy the banner description uses.

Announcement titles and link labels SHALL be rendered as text nodes, never via `dangerouslySetInnerHTML`.

The client SHALL NOT re-validate link hrefs, since the `client-config-endpoint` capability has already dropped unsafe entries.

#### Scenario: Script content in a description is stripped

- **WHEN** an announcement description contains `<script>alert(1)</script>Hello`
- **THEN** the rendered row contains no `<script>` element and still shows `Hello`

#### Scenario: Safe description markup is preserved

- **WHEN** an announcement description contains `<strong>` emphasis
- **THEN** the rendered row preserves the emphasis

#### Scenario: A title containing markup is displayed literally

- **WHEN** an announcement title is `Release <b>3.0</b>`
- **THEN** the row displays the literal text `Release <b>3.0</b>` and renders no `<b>` element

---

### Requirement: The popover closes on outside click and on Escape

The popover SHALL close when the user clicks outside it, and when the user presses `Escape`. Closing via `Escape` SHALL return focus to the pill so keyboard navigation is not lost.

The `Escape` handler SHALL be bound in a way that works while focus is inside the popover, including when the popover renders in a portal.

Focus restoration SHALL NOT depend on a ui-kit component forwarding a `ref` to its underlying element. Any test covering this requirement SHALL move focus into the popover before pressing `Escape`, so it cannot pass on focus the pill merely retained from the opening click.

#### Scenario: Outside click closes the popover

- **WHEN** the popover is open and the user clicks outside it
- **THEN** the popover closes

#### Scenario: Escape closes the popover and restores focus

- **WHEN** the popover is open, focus has moved to an element inside it, and the user presses `Escape`
- **THEN** the popover closes and focus returns to the pill

---

### Requirement: Pill and popover are accessible and RTL-correct

The system SHALL meet WCAG 2.1 AAA expectations:

- The pill SHALL be a `button` carrying `aria-expanded` reflecting the popover state, `aria-haspopup`, and `aria-controls` referencing the popover element's id. These attributes are required regardless of whether the pill is a raw `button` or a design-system button component — adopting a ui-kit component SHALL NOT be treated as a reason to drop them.
- The pill's accessible name SHALL be a complete i18n phrase including the count, correctly pluralized — not a bare number or symbol.
- The popover SHALL be a named region containing a list, with one list item per announcement.
- Row titles SHALL NOT be heading elements; the popover SHALL NOT contribute entries to the document outline.
- Each row link SHALL expose its visible label as its accessible name and SHALL communicate that it opens a new tab.
- Every user-visible `aria-label` SHALL come from `t()` with a key declared in `apps/chat/src/constants/translation-keys.ts`.
- Row **titles** and the pill label SHALL meet AAA contrast (7:1 for normal-size text) against their surfaces, via `text-primary`.
- Row **descriptions** are treated as muted supporting text and use `text-secondary` (~6.2:1 on light surfaces). This is a deliberate, documented deviation from the AAA target: the title carries the announcement's meaning and the link carries its action, so the description is genuinely secondary. It still clears AA (4.5:1). It SHALL NOT be copied as precedent for content text elsewhere — `.claude/rules/a11y.md` continues to forbid `text-secondary` for real body content.
- Directional styling SHALL use logical properties and direction-aware placement.

#### Scenario: The pill announces its state and purpose

- **WHEN** a screen-reader user focuses the pill while the popover is closed
- **THEN** it is announced as a collapsed button whose name conveys how many announcements there are

#### Scenario: Expanded state is exposed programmatically

- **WHEN** the popover is open
- **THEN** the pill's `aria-expanded` is `true` and its `aria-controls` references the rendered popover element

#### Scenario: The popover is announced as a list

- **WHEN** a screen-reader user enters the open popover
- **THEN** it is announced as a labeled region containing a list with one item per announcement

#### Scenario: Row titles create no headings

- **WHEN** the popover renders any number of announcements
- **THEN** no heading element is added to the document for their titles

#### Scenario: Row links announce that they open a new tab

- **WHEN** a screen-reader user reaches a row link
- **THEN** its accessible name includes both the visible label and an indication that it opens in a new tab

---

### Requirement: The popover bounds its own height

The popover SHALL cap its height and scroll its content internally rather than growing past the viewport, regardless of how many announcements are configured.

#### Scenario: A long list scrolls inside the popover

- **WHEN** enough announcements are configured that the list exceeds the popover's maximum height
- **THEN** the popover keeps its maximum height and its content scrolls internally, without the page scrolling
