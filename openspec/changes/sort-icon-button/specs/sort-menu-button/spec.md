## ADDED Requirements

### Requirement: `@epam/ai-dial-chat-shared` exports an icon-only sort trigger

`libs/chat-shared` SHALL export a `SortMenuButton` component from `libs/chat-shared/src/components/SortMenuButton/SortMenuButton.tsx`, together with its `SortMenuButtonProps`, `SortMenuButtonColors` and `SortMenuButtonOption` types, through `libs/chat-shared/src/index.ts`. The props are:

| Prop | Type | Default |
| --- | --- | --- |
| `options` | `SortMenuButtonOption[]` (`{ value: string; label: string }`) | required |
| `value` | `string \| undefined`, the applied option | — |
| `onChange` | `(value: string) => void` | required |
| `label` | `string`, the trigger's accessible name and tooltip | `'Sort'` |
| `icon` | `ReactNode`, which replaces the glyph | `IconArrowsSort` |
| `size` | `ElementSize` | `ElementSize.Standard` |
| `iconSize` | `number` | `DIAL_ICON_SIZE.MD` |
| `colors` | `SortMenuButtonColors` (`{ icon?: string }`) | — |
| `className` | `string`, applied to the trigger | — |
| `open` / `onOpenChange` | `boolean` / `(open: boolean) => void`, forwarded to the kit `Dropdown` for controlled open state | uncontrolled |

Rendering rules:

- The component SHALL render a kit `Dropdown` whose trigger is a 2.0 ghost `IconButton`.
- The trigger's `aria-label` is `label`, and its tooltip (`tooltipProps`) shows the same string.
- The glyph carries `aria-hidden` and `stroke={DIAL_KIT_ICON_STROKE}`.
- It SHALL render nothing when `options` is empty.

The lib SHALL take every string from props and SHALL NOT import i18n. It SHALL NOT own sort state: it shows `value` and reports picks through `onChange`.

**Feature flag:** none. **i18n:** none in the lib. Hosts pass `t(ButtonsI18nKeys.Sort)` as `label`.

#### Scenario: Trigger is named by the static label

- **WHEN** `SortMenuButton` renders with `label="Sort"`, `value="newest"`, and options Newest and Oldest
- **THEN** the only button in the toolbar slot is named "Sort", its name contains neither "Newest" nor "Oldest", and it shows no visible text

#### Scenario: Empty options render nothing

- **WHEN** `options` is `[]`
- **THEN** the component renders no element

### Requirement: The menu marks the applied option and reports picks

Each option SHALL become a `DropdownItem` with `mark: MenuItemMark.Check` and `checked: option.value === value`, in the order given. Activating an item SHALL call `onChange(option.value)` once and close the menu. The kit's Escape handling and focus return to the trigger SHALL stay in force: the component adds no `onKeyDown` of its own. The item list SHALL be built in `useMemo`, keyed on `options`, `value` and `onChange`.

#### Scenario: Applied option is checked

- **WHEN** the user opens the menu while `value` is `"oldest"`
- **THEN** the trigger has `aria-expanded="true"`, the "Oldest" item is `aria-checked="true"`, and every other item is `aria-checked="false"`

#### Scenario: Choosing an option reports it

- **WHEN** the user opens the menu and activates "Name A-Z"
- **THEN** `onChange` is called with that option's `value`, and focus returns to the trigger

#### Scenario: Unknown value checks nothing

- **WHEN** `value` matches no option
- **THEN** the menu opens with no item checked, and the trigger is still named by `label`

### Requirement: The sort trigger is themeable, symmetric and keyboard-operable

The glyph colour SHALL come from `colors.icon`. It is set through `buildCssVars` as `--smb-icon` and read in `SortMenuButton.module.scss` as `var(--smb-icon, var(--text-secondary, #57647a))`. Hover and `:focus-visible` SHALL share the same background change. `IconArrowsSort` is symmetric and SHALL NOT be mirrored under `dir="rtl"`. The trigger is a native button, reachable with Tab and opened with Enter or Space.

#### Scenario: Host colour reaches the glyph

- **WHEN** `colors={{ icon: 'red' }}` is passed
- **THEN** the trigger element's inline style sets `--smb-icon: red`

#### Scenario: RTL does not flip the glyph

- **WHEN** the component renders under `<html dir="rtl">`
- **THEN** the glyph carries no `rtl:scale-x-[-1]` or rotate class
