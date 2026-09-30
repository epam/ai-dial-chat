# Proposal

## Why

Issue [#8937](https://github.com/epam/ai-dial-chat/issues/8937): when a message's skill mention can't be resolved against the viewer's loaded skill listing — most commonly a personal skill the conversation owner used and never shared, seen while viewing a conversation shared with you — the `ChatSkill` chip already degrades to a URL-derived fallback name per the existing "Skill absent from the listing" scenario (`skill-message-payload` spec), but its tooltip still shows a description-less card with a "View details" button that leads nowhere: clicking it opens the details side panel, which has no metadata to show and never resolves. The viewer has no way to tell "this skill still exists, just isn't shared with me" from "this skill is gone," and no actionable next step (asking the owner to share it).

## What Changes

- `ChatSkill` (`libs/skills`) gains an unresolved-state variant, replacing the current dead-end description-less tooltip: when a chip's url is absent from every loaded pool (`skills`/`sharedWithMe`/`publicSkills`), the tooltip shows an icon plus a one-line explanation instead of the description + "View details" button, and "View details" is not offered (there is nothing to open).
- Two unresolved sub-states, distinguished purely from data already in memory (the url's `skills/{bucket}/{path}` bucket segment vs. the viewer's own `user.bucket` — no new request):
  - **Own bucket, not found** → the viewer's own skill was deleted. Trash icon. "This skill has been deleted. Its details are no longer available."
  - **Foreign bucket** → someone else's personal skill, never shared with the viewer (or since revoked/deleted — indistinguishable without a request, and not worth one). Lock icon. "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you."
- Applies symmetrically to both the user-message rendering path (`renderHistorySkillSegments`) and the assistant-message path (`renderHistorySkills`) — both already route through the same `ChatSkill` component and `onViewDetails` wiring today, so no divergent logic is introduced between the two.
- The chip's visible `/{name}` label is unchanged (still today's URL-slug fallback via `getSkillFallbackName`); only the tooltip content and the presence of "View details" change.
- No new endpoint, request, or generated-client change. No change to the composer/selection flow, the details side panel, or the unrelated per-message edit/delete hover actions.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `skill-message-payload`: the "Skill metadata resolved from the carried url" requirement's unresolved-lookup fallback ("description-less tooltip, no error, no retry") is replaced by the two-variant unresolved tooltip described above; the "Conversation history renders each skill mention inline" requirement's tooltip scenario ("View details" always offered) and the accessibility requirement (keyboard access to "View details") are updated to state that "View details" is conditional on resolution.

## Impact

- `libs/skills/src/models/chat-skill-props.ts` — new prop(s) on `ChatSkillProps` for the unresolved variant (reason + icon) and new label overrides on `ChatSkillLabels`, following the existing `isUnsupported`/`unsupportedTooltipLabel` pattern already on this same interface.
- `libs/skills/src/components/ChatSkill/ChatSkill.tsx` — branch the tooltip content and suppress "View details" for the unresolved variant, mirroring the existing `isUnsupported` branch.
- `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx` — `renderHistorySkillSegments`/`renderHistorySkills` compute the resolution state (already have `skillByUrl`; need the viewer's own bucket, passed in from the app edge per library isolation — `libs/skills` must not read auth/user context itself).
- `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` — supplies `user.bucket` (from `UserContext`, already read elsewhere in `apps/chat`) into the lib-level hook.
- i18n: two new user-visible strings (the trash and lock tooltip messages) added to `apps/chat/src/i18n/locales/en.json` under a new `SkillsI18nKeys`-style entry (or the existing skills key group), referenced through `translation-keys.ts` per project convention. No copy for existing strings changes.
- No backend, API contract, or persisted-data changes — this is a pure client-side rendering decision over data already resolved for other reasons.
- Rollback: purely additive/branching UI logic behind existing props; reverting drops the new tooltip branch and prop, restoring today's dead-end tooltip. Not breaking — no persisted shape, wire contract, or public lib export is removed.
