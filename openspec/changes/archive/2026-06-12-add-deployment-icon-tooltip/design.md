## Context

`DeploymentIcon` (in `libs/conversation-input`) renders a rounded badge with a model/agent image. It is used in `ConversationRow` (in `libs/conversation-panel`) as the `iconBefore` of a `DialGhostButton`. Currently no tooltip is shown, so users cannot identify the agent/model from the icon alone without reading the conversation title.

The UI kit provides `DialTooltip`, which wraps any element and shows a hover/focus tooltip. `DeploymentIcon` is a pure display component with no deps on routing, i18n, or app state — an optional `tooltip` prop can be added without violating lib isolation rules.

## Goals / Non-Goals

**Goals:**

- `DeploymentIcon` shows a `DialTooltip` with the deployment name when `tooltip` is provided.
- `ConversationHistoryItem` exposes `iconTooltip?: string` so the app can pass the deployment display name.
- `ConversationRow` wires `item.iconTooltip` → `DeploymentIcon.tooltip`.

**Non-Goals:**

- Changing tooltip styling beyond `DialTooltip` defaults.
- Adding tooltips on `DeploymentIcon` usages outside `ConversationRow` (AssistantMessageBubble, ModelSelector) — those are separate concerns.
- Fetching or resolving deployment names inside the lib.

## Decisions

### Tooltip prop lives on `DeploymentIcon`, not on its callers

Adding `tooltip?: string` directly to `DeploymentIcon` keeps the wrapping logic in one place. The alternative — wrapping at each call site with `<DialTooltip>` — would require every consumer to change and risks inconsistency.

### `DialTooltip` wraps the badge only when `tooltip` is present

When `tooltip` is undefined the component renders exactly as before (no extra DOM node). This keeps the zero-tooltip path free of overhead and avoids breaking existing snapshots.

### `iconTooltip` on `ConversationHistoryItem` (not a callback)

A plain string field is the simplest contract. The app already maps deployment objects to `ConversationHistoryItem`; it can set `iconTooltip` to the deployment display name at that mapping point. A resolver callback would add complexity with no benefit for this use case.

## Risks / Trade-offs

- **Risk**: `DialTooltip` adds a wrapper `<span>` (via `triggerClassName`) around the badge — this could affect the flex layout of `DialGhostButton`'s `iconBefore` slot.
  **Mitigation**: Inspect `DialTooltip`'s rendered structure and pass `triggerClassName` with `flex shrink-0` if needed to preserve sizing.

- **Risk**: Consumers already constructing `ConversationHistoryItem` objects will not pass `iconTooltip`, leaving tooltips absent — this is intentional (opt-in) and not a regression.
