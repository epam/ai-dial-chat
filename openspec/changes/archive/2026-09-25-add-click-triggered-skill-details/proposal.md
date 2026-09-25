## Why

Skill mentions in the conversation composer currently reveal their description card on hover or focus. That conflicts with text selection in the editable input and makes the details surface appear without an explicit user action.

## What Changes

- Add a click-triggered details-card mode to the reusable skill mention component.
- Expose the mode through the host-agnostic skill selector overlay hook.
- Keep the chat application's existing hover behavior while allowing external hosts to opt into click-triggered mode.
- Preserve the existing default hover/focus behavior for hosts that do not opt in.

## Problem

The input renders `/skill-name` as a selectable mention while the reusable component also treats hover and focus as a request to show its details. Users need an intentional click to inspect the description card without opening the side panel.

## Solution

Add a typed trigger option to the skills library. In click mode, the mention controls the UI kit's tooltip state and opens the existing description card only after click or keyboard activation. The existing "View details" action remains available inside the card; this change does not invoke the side panel directly. The parent chat adapter omits the option and retains hover behavior; an external host can supply click mode.

## Non-Goals

- Changing skill selection rows in the Add or slash-command menus.
- Changing details behavior for sent-message skill chips unless a host opts in separately.
- Adding strings, endpoints, feature flags, telemetry, or persisted state.

## Acceptance Criteria

- A host that opts into click mode opens the card only through click, Enter, or Space.
- The card can be dismissed through the existing tooltip dismissal behavior.
- The card's "View details" button continues to open the existing side panel.
- Existing library consumers retain hover/focus behavior when they omit the option.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `skill-message-payload`: Conversation-input mentions open their existing description card on explicit activation instead of hover or focus.

## Impact

The change touches `libs/skills` (`ChatSkill`, its public props, and `useSkillSelectorOverlay`) and the app-level `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` adapter. The library remains host-agnostic: it receives only a trigger mode; external app adapters choose it, while the existing injected details-panel component owns host-specific details rendering. The closest implementation is `libs/skills/src/components/ChatSkill/ChatSkill.tsx:13`; it already owns tooltip generation and the callback to the host's details panel. No i18n change is needed. This is backward compatible: omitting the new optional setting preserves hover behavior; removing a host opt-in rolls back click behavior.

Alternatives considered: a PG-only JSX override would duplicate library state and fail to cover all `ChatSkill` render paths; changing the default to click would be a breaking behavior change for other hosts. A per-host optional setting is selected.
