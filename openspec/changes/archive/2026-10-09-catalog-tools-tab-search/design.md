## Context

`Tools` is the Tools tab body in `DetailsPanel` and the public `ToolsTab` export. It has no state today.

## Decisions

### D1. Search state lives in the tab

The query is local `useState` in `Tools`. Hosts need nothing beyond labels, and the state resets when the tab unmounts — switching tab or item in `DetailsPanel` already unmounts it. A controlled `query` prop can be added later if a host needs to persist it.

### D2. Match on name and description, case-insensitive substring

Tool names are identifiers (`notion-fetch`); descriptions carry the words a user types. The query is trimmed and lower-cased; input params and annotations are not searched.

### D3. The count is the number of tools shown

With an empty query it is the total (the design's "27 tools"). While searching it is the match count, so it doubles as the result announcement through `role="status"` / `aria-live="polite"` (a11y rule: dynamic feedback needs a live region).

### D4. Labels follow the `ToolsLabels` / `ItemDetailsTexts` split

`ToolsTab` takes `labels` like its column headings. `DetailsPanel` builds them from `ItemDetailsTexts`, setting only defined fields so an unset text never overrides a default with `undefined`. The count is a `(count) => string` function, matching `contentFileCountLabel`, so hosts can pluralise.

## Risks

- Hosts snapshotting the Tools tab see the new header. It is additive; no prop changes meaning.
