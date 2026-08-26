# @epam/ai-dial-settings-panel

## Overview

Provides `SettingsPanel`, a presentational vertical navigation panel: an optional 64px section
header followed by icon + label rows, with the active row highlighted. The panel uses the raised
background token; its header uses `dial-h1-text` and the primary text token. The component is fully
host-agnostic — it takes already-localized labels, host-resolved icons, and the active/selected
state via props, and calls back via `onSelect`. It implements the ARIA "automatic activation"
tabs pattern adapted to a vertical layout: roving `tabIndex`, `ArrowUp`/`ArrowDown` move focus and
selection between enabled rows (wrapping at the ends), `Home`/`End` jump to the first/last enabled
row, and disabled rows are skipped entirely by keyboard navigation. A single row remains
semantically selected but uses the neutral visual state because there is no alternative tab to
distinguish it from.

## Installation

```json
{
  "dependencies": {
    "@epam/ai-dial-settings-panel": "*"
  }
}
```

## Peer Dependencies

- `react` ^19.2.7
- `@tabler/icons-react` ^3.44.0
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

Pass `styles={{ typography, colors }}` to override the section-header/label typography classes or
the row background/text/focus colors (applied as CSS custom properties):

```tsx
<SettingsPanel
  activeId="usage"
  onSelect={setActiveTab}
  items={items}
  styles={{
    colors: {
      activeRowBackground: '#e6f0ff',
      rowFocusOutline: '#161b2d',
    },
  }}
/>
```

## Types

- `SettingsPanelItem` — `{ id, label, icon?, disabled? }`
- `SettingsPanelProps` — `{ items, activeId, onSelect, sectionLabel?, styles?, className? }`
- `SettingsPanelStyles` — `{ typography?, colors? }`
- `SettingsPanelColors` — CSS-custom-property color overrides
- `SettingsPanelTypography` — typography class overrides
