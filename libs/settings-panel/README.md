# @epam/ai-dial-settings-panel

## Overview

Provides two presentational, host-agnostic surfaces for a chat application's Settings area:

- `SettingsPanel`, a vertical navigation panel: an optional 64px section header followed by
  icon + label rows, with the active row highlighted. The panel uses the raised background token;
  its header uses `dial-h1-text` and the primary text token. It takes already-localized labels,
  host-resolved icons, and the active/selected state via props, and calls back via `onSelect`. It
  implements the ARIA "automatic activation" tabs pattern adapted to a vertical layout: roving
  `tabIndex`, `ArrowUp`/`ArrowDown` move focus and selection between enabled rows (wrapping at the
  ends), `Home`/`End` jump to the first/last enabled row, and disabled rows are skipped entirely
  by keyboard navigation. A single row remains semantically selected but uses the neutral visual
  state because there is no alternative tab to distinguish it from.
- `ExtensionsSection`, the Extensions services table: a Name / Description / Actions header row
  (the Actions header is screen-reader-only text over a visually empty column) plus one row per
  service. Each row renders an initials avatar with an optional corner warning badge, the service
  name, the service description, and a host-supplied trailing action. All user-visible strings,
  the warning flag, and the action arrive via props — the host owns `t()`, service state, and the
  login/logout wiring.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-settings-panel": "*"
  }
}
```

Import the stylesheet once in the consuming app:

```ts
import '@epam/ai-dial-settings-panel/styles.css';
```

## Peer Dependencies

- `react` ^19.2.8
- `@epam/ai-dial-ui-kit`
- `@epam/ai-dial-chat-shared`

## Components

### SettingsPanel

```tsx
import { IconLayoutGrid, IconUser } from '@tabler/icons-react';
import { SettingsPanel } from '@epam/ai-dial-settings-panel';

<SettingsPanel
  sectionLabel="Settings"
  activeId="usage"
  onSelect={(id) => setActiveTab(id)}
  items={[
    {
      id: 'general',
      label: 'General',
      icon: <IconUser size={18} />,
      disabled: true,
    },
    { id: 'usage', label: 'Usage', icon: <IconLayoutGrid size={18} /> },
  ]}
/>;
```

Pass `styles={{ typography }}` to override the section-header typography class. The rows are
drawn by the UI kit's `Tabs`, so their colors and typography (`dial-small-text` /
`dial-small-semi-text`) come from the kit and are not overridable here.

### ExtensionsSection

```tsx
import { ExtensionsSection } from '@epam/ai-dial-settings-panel';

<ExtensionsSection
  rows={[
    {
      id: 'dial-native',
      displayName: 'DIAL Scheduler',
      description: 'Run tasks on a timetable.',
      isWarningVisible: false,
      authorizeLabel: 'Connect the DIAL Scheduler service',
      action: <button type="button">Log in</button>,
    },
  ]}
  labels={{
    tableAriaLabel: 'Extensions',
    nameColumnLabel: 'Name',
    descriptionColumnLabel: 'Description',
    actionsColumnLabel: 'Actions',
  }}
/>;
```

The section renders the table shell (ARIA `table`/`row`/`columnheader` roles, the divider rules,
and the desktop column grid) and one row per `rows` entry. The header row is hidden below the
`desktop:` breakpoint, where the rows stack. `action` is the trailing cell's content and is owned
entirely by the host — an empty `null` renders an empty cell with no layout shift.

Pass `styles={{ colors, typography }}` to override the container background, column-header,
name, description, and warning-badge colors (as CSS custom properties) and the column-header,
name, and description typography classes.

## Types

- `SettingsPanelItem` — `{ id, label, icon?, disabled? }`
- `SettingsPanelProps` — `{ items, activeId, onSelect, sectionLabel?, styles?, className? }`
- `SettingsPanelStyles` — `{ typography? }`
- `SettingsPanelTypography` — `{ sectionLabelClassName? }`
- `ExtensionServiceItem` — `{ id, displayName, description, isWarningVisible, authorizeLabel, action }`
- `ExtensionsLabels` — `{ tableAriaLabel, nameColumnLabel, descriptionColumnLabel, actionsColumnLabel }`
- `ExtensionsSectionProps` — `{ rows, labels, styles? }`
- `ExtensionsStyles` — `{ colors?, typography? }`
- `ExtensionsColors` — `{ containerBackground?, columnHeaderColor?, rowDividerColor?, nameColor?, descriptionColor?, warningBadgeColor? }`
- `ExtensionsTypography` — `{ columnHeaderClassName?, nameClassName?, descriptionClassName? }`

## Public class names

A host embedding this package cannot style it through its CSS-module locals —
they are hashed at build time — nor through DOM order or ARIA attributes, which
are structure and accessibility contracts rather than styling ones. Selected
elements therefore carry a stable public class.

| Key       | Class                          | Element                                        |
| --------- | ------------------------------ | ---------------------------------------------- |
| `panel`   | `dial-settings-panel-panel`    | The panel root                                 |
| `tabList` | `dial-settings-panel-tab-list` | The vertical tab list holding the section rows |
| `tab`     | `dial-settings-panel-tab`      | Every section row, selected or not             |

```tsx
import { SETTINGS_PANEL_CLASS } from '@epam/ai-dial-settings-panel';

SETTINGS_PANEL_CLASS.tab; // 'dial-settings-panel-tab'
```

`role="tablist"` and `role="tab"` stay accessibility contracts — these classes
are what a host selects on instead.

The classes carry no declarations of their own: nothing in `styles.css`
selects on them, so they change nothing until a host writes a rule. Renaming
one, or moving it to a different element, is a breaking change. The convention
is in [`openspec/lib-styling-guide.md`](../../openspec/lib-styling-guide.md).

Write host overrides with CSS logical properties (`margin-inline-start`,
`inset-inline-end`) so they keep working under `dir="rtl"`.
