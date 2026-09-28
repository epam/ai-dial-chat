## Context

`ChatSkill` in `libs/skills/src/components/ChatSkill/ChatSkill.tsx` currently renders an uncontrolled `InteractiveTooltip`; the UI kit consequently opens it on hover and keyboard focus. `useSkillSelectorOverlay` creates these chips for live mentions as well as history. The chat adapter at `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` is the appropriate host boundary for choosing the conversation-input interaction.

## Goals / Non-Goals

**Goals:**

- Let a host opt a live conversation-input mention into an explicit click/keyboard-triggered description card.
- Keep the existing card content and its "View details" button, which retains ownership of opening the injected side panel.
- Keep hover/focus as the default for existing `ChatSkill` consumers and history chips.

**Non-Goals:**

- Change the selection action of favorite rows in the Add and slash-command menus.
- Open the details side panel directly from a mention click.
- Add a feature flag, i18n key, API endpoint, cache, analytics, or persistent state.

## Decisions

### An optional trigger mode belongs to the skills library

`ChatSkill` SHALL accept an optional `detailsTrigger` union (`'hover' | 'click'`) that defaults to `'hover'`. In click mode it SHALL own a controlled `InteractiveTooltip` open state. Passing `open` to that UI-kit component disables its hover and focus interactions; the chip's click, Enter, and Space handlers open the description card, while the tooltip's existing dismissal callback closes it.

This keeps the interaction and its accessibility behavior with the component that owns the tooltip. A PG-only clone of the rendered React node was rejected because it cannot safely replace the component's internal tooltip state or cover every active-mention render path. Changing the default was rejected because it would alter published-library behavior for every host.

### The selector hook limits the option to live mentions

`UseSkillSelectorOverlayOptions` SHALL add an optional `activeMentionDetailsTrigger` setting and pass it only to the `ChatSkill` instances created in `activeMentions`. The default remains hover. History renderers continue to omit the setting, preserving their current hover/focus interaction.

The parent chat adapter omits the option and retains hover behavior. An external adapter can supply `'click'` for its composer, edit input, and preview composer. The library receives only the resolved trigger value; app routing, details data fetching, and the injected `detailsPanelComponent` remain outside the library boundary.

### Accessibility and layout remain native to the existing surface

The chip remains keyboard reachable. In click mode Enter and Space open the card; Escape and outside dismissal continue through `InteractiveTooltip`. No new visible strings, ARIA labels, directional layout, icons, loading state, or error state are introduced. The existing card already owns its description loading/empty rendering and its keyboard-reachable "View details" action.

## Risks / Trade-offs

- [Clicking a selectable text mention can also follow text-selection gestures] → handlers only open the card on explicit click or keyboard activation; retain the chip's existing selectable text markup and validate selection behavior manually.
- [An optional library API adds a small public surface] → use a two-member, defaulted union and cover both default and click modes with component and hook tests.
- [The app enables the setting for every consumer of its adapter] → this is intentional: the adapter is dedicated to conversation-input mentions; history chips retain their default behavior.

## Migration Plan

1. Publish the updated `@epam/ai-dial-skills` package with the optional property.
2. Update an external app dependency and set `activeMentionDetailsTrigger: 'click'` in that app's adapter when click-triggered details are desired.
3. Roll back by removing the external adapter option; the library default restores hover/focus without data migration or backend impact.

## Open Questions

None.
