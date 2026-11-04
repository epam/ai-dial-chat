## MODIFIED Requirements

### Requirement: DeploymentSelectorFieldTrigger meets accessibility and RTL requirements independent of its host form

The trigger SHALL expose `aria-haspopup="listbox"` at widths from 768px (`"dialog"` below 768px, where the panel opens in a bottom sheet), `aria-expanded` reflecting open state, and `aria-labelledby` referencing the host-supplied label element's id. The trigger is built on the `Input` component from `@epam/ai-dial-ui-kit` (`readOnly`, with a trailing `iconAfter` chevron/spinner) — the same recipe `Select` uses for its own field — so its interactive target height matches `Input`'s standard field height (40px) and is consistent with every other field in the host form (Display name, Description, Prompt), rather than a bespoke 44×44px minimum. Keyboard users SHALL be able to open the panel (Enter/Space), navigate its search box and list (Tab/Arrow keys, inherited from the existing panel implementation), select an item (Enter), and close it (Escape) with focus restored to the trigger input. All layout SHALL use Tailwind logical properties; the chevron icon's directional treatment (if any) SHALL be verified against an RTL locale rather than assumed symmetric. The component SHALL choose Dropdown from 768px and BottomSheetShell below 768px using the shared menu-specific query, reusing existing content and max-h-[90dvh] sheet sizing. DeploymentSelectorPanel focus initialization SHALL follow the actual menu presentation. Host form layout SHALL retain its existing 1280px policy.

#### Scenario: Keyboard user can open, select, and close

- **WHEN** a keyboard-only user Tabs to the trigger, presses Enter to open it, uses Arrow keys and Enter to select a deployment
- **THEN** the panel opens, the selection is applied, the panel closes, and focus returns to the trigger input

#### Scenario: Escape closes the panel and restores focus

- **WHEN** the panel is open and the user presses Escape
- **THEN** the panel closes and focus returns to the trigger input

#### Scenario: Trigger exposes expanded and labelled state

- **WHEN** the panel is open
- **THEN** the trigger has `aria-expanded="true"` and `aria-labelledby` pointing at the host's label element

#### Scenario: Trigger matches the standard field height used elsewhere in the form

- **WHEN** the trigger is rendered on either the `mobile` or `desktop` breakpoint
- **THEN** its field height matches `Input`'s standard size (40px), the same height as the form's other `Input`-based fields

#### Scenario: Component renders correctly under RTL

- **WHEN** `document.documentElement.dir` is `rtl`
- **THEN** the trigger's label, selected value, and chevron lay out mirrored using logical properties, with no hard-coded left/right offset breaking the mirrored layout

#### Scenario: Tablet picker focuses its anchored content
- **WHEN** the picker opens at 768, 1024 or 1279px
- **THEN** it exposes listbox popup semantics and runs existing desktop focus initialization without changing host form layout
