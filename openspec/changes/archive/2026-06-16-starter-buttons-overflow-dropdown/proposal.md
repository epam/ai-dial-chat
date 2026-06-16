## Why

When a deployment defines more than 4 starter options — or when the viewport is narrow — all buttons wrap into multiple rows, cluttering the chat input area and pushing the input further down the page. A single overflow menu keeps the UI compact at any width while still exposing every starter.

## What Changes

- When there are more than 4 starter options, show the first 4 as pill buttons and collapse the remainder into an overflow `⋯` menu button.
- When the available width is too narrow to fit all visible buttons on one row, dynamically recalculate how many fit and move the rest into the overflow menu.
- The overflow menu opens a dropdown listing the hidden starters by title; selecting one triggers the same `onSelect` callback as a direct button click.
- The `⋯` button is always the last item in the row, placed after the visible pills.

## Capabilities

### New Capabilities

- `starter-buttons-overflow`: Overflow menu that collapses starter options exceeding 4 (or exceeding the available row width) into a `⋯` dropdown, with full keyboard and RTL support.

### Modified Capabilities

<!-- No existing spec-level requirements are changing. -->

## Impact

- `apps/chat/src/components/StarterButtons/StarterButtons.tsx` — primary change; adds overflow logic and dropdown rendering.
- `@epam/ai-dial-ui-kit` — `DialRoundedButton` is kept for visible pills; a suitable Dial dropdown/popover component will be used for the overflow menu (verify via MCP before implementation).
- No API, routing, or data-shape changes required.
