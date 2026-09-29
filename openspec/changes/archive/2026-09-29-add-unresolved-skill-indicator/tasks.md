# Tasks

Slicing strategy: vertical — one path (lib-level tooltip content → lib-level history hook → app wiring) working end to end before widening to accessibility/RTL polish and both message-author paths, which already share the same call sites per Design Decision 4.

## 1. `SkillInfoTooltipContent`: unresolved-reason branch

- [x] 1.1 In `libs/skills/src/models/skill-info-tooltip-content-props.ts`, add `unresolvedReason?: 'deleted' | 'not-shared'` alongside the existing `unsupportedMessage`, plus `deletedMessage`/`notSharedMessage` label props for the two fixed sentences (mirroring how `unsupportedMessage` is already a caller-supplied string, not a hardcoded one). JSDoc each new prop per `.claude/rules/libs.md` (inline `/** ... */`, states the default is "none — required when `unresolvedReason` is set").
- [x] 1.2 In `libs/skills/src/components/SkillInfoTooltipContent/SkillInfoTooltipContent.tsx`, add the `unresolvedReason` branch before the existing `unsupportedMessage != null` check: render `IconTrash` (for `'deleted'`) or `IconLock` (for `'not-shared'`) at `DIAL_ICON_SIZE.SM`/`stroke={DIAL_KIT_ICON_STROKE}`, `aria-hidden`, beside the corresponding fixed-message `<p>`, no `Button`. Reuse the existing `text-start` paragraph styling from the `unsupportedMessage` branch.
- [x] 1.3 Add cases to `libs/skills/src/components/SkillInfoTooltipContent/tests/SkillInfoTooltipContent.spec.tsx`: `deleted` renders the trash icon + deleted message with no "View details" button; `not-shared` renders the lock icon + not-shared message with no button; existing `isUnsupported`/resolved cases still pass unchanged.

Verification: `npm run test:file -- libs/skills/src/components/SkillInfoTooltipContent/tests/SkillInfoTooltipContent.spec.tsx`

## 2. `ChatSkill`: wire the new prop through

- [x] 2.1 In `libs/skills/src/models/chat-skill-props.ts`, add `unresolvedReason?: 'deleted' | 'not-shared'` to `ChatSkillProps`, and `deletedTooltipLabel`/`notSharedTooltipLabel` to `ChatSkillLabels` (following the existing `unsupportedTooltipLabel` doc pattern, English defaults inline per the no-i18n-in-libs rule).
- [x] 2.2 In `libs/skills/src/components/ChatSkill/ChatSkill.tsx`, destructure `unresolvedReason` and the two new labels (with their English defaults, matching `unsupportedTooltipLabel`'s default style), and pass them into `SkillInfoTooltipContent` ahead of the `isUnsupported` branch (Design Decision 1's branch order).
- [x] 2.3 Add cases to `libs/skills/src/components/ChatSkill/tests/ChatSkill.spec.tsx`: `unresolvedReason="deleted"` and `unresolvedReason="not-shared"` each render their tooltip content with no "View details" button on hover/focus; the chip's visible `/{name}` label is unaffected by `unresolvedReason` (no color/class change — only the tooltip differs, per proposal scope).

Verification: `npm run test:file -- libs/skills/src/components/ChatSkill/tests/ChatSkill.spec.tsx`

## 3. Lib-level history hook: compute the reason from data already in memory

- [x] 3.1 In `libs/skills/src/utils/skill-url.ts`, add a small local helper (e.g. `getSkillUrlBucket(url: string): string | null`) that extracts the bucket segment from a `skills/{bucket}/{path}` url — a local, self-contained split alongside the existing `getSkillFallbackName`, not an import from `chat-hooks` (Design Decision 2, second alternative).
- [x] 3.2 In `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx`, add a required `viewerBucket: string` parameter to the hook's options. Where `renderHistorySkillSegments`/`renderHistorySkills` currently look up `skillByUrl.get(url)` and fall back to `getSkillFallbackName`, add: when unresolved, compute `reason = getSkillUrlBucket(url) === viewerBucket ? 'deleted' : 'not-shared'` and pass it to the rendered `<ChatSkill>`'s new `unresolvedReason` prop.
- [x] 3.3 Update `libs/skills/src/hooks/useSkillSelectorOverlay/tests/useSkillSelectorOverlay.spec.tsx`: a history entry whose url matches `viewerBucket` renders `unresolvedReason="deleted"`; one whose url's bucket differs renders `unresolvedReason="not-shared"`; a resolved entry renders neither. Cover both `renderHistorySkillSegments` (user path) and `renderHistorySkills` (assistant path) with the same two unresolved cases, proving Design Decision 4's symmetry.
- [x] 3.4 Architecture guard: confirm `libs/skills` gained no new dependency (`libs/skills/package.json` unchanged) and no import of `chat-hooks`, auth/user context, or any host-owned concept — `viewerBucket` arrives as a plain string parameter, per AGENTS.md §Library isolation.

Verification: `npm run test:file -- libs/skills/src/hooks/useSkillSelectorOverlay/tests/useSkillSelectorOverlay.spec.tsx`

## 4. App-edge wiring: supply the viewer's own bucket

- [x] 4.1 In `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx`, read `user.bucket` from the existing `useUser()` hook (`apps/chat/src/context/auth/UserContext.tsx`) and pass it as `viewerBucket` into the `useHostAgnosticSkillSelectorOverlay({ ... })` call.
- [x] 4.2 Add `apps/chat/src/constants/translation-keys.ts` entries `SkillSelectorI18nKeys.DeletedTooltipLabel = 'skillSelector.deletedTooltipLabel'` and `SkillSelectorI18nKeys.NotSharedTooltipLabel = 'skillSelector.notSharedTooltipLabel'`, alongside the existing `UnsupportedTooltipLabel`/`ViewDetailsLabel` entries in that same enum.
- [x] 4.3 Add the two matching strings to `apps/chat/src/i18n/locales/en.json` under the `skillSelector` namespace: `deletedTooltipLabel`: "This skill has been deleted. Its details are no longer available." and `notSharedTooltipLabel`: "You don't have access to this skill, so its details aren't shown. Ask the chat owner to share it with you."
- [x] 4.4 In the same `useSkillSelectorOverlay.tsx`, read both new keys via `t()` and pass them into the lib hook's `labels.panelLabels` (or the top-level `labels`, matching how `unsupportedTooltipLabel`/`viewDetailsLabel` are already threaded — see the existing `labels` `useMemo` block) so they reach `ChatSkill`'s `deletedTooltipLabel`/`notSharedTooltipLabel` props.

Verification: `npm run test:file -- apps/chat/src/components/SkillSelector/tests/useSkillSelectorOverlay.spec.tsx` (extend or add coverage that `viewerBucket` and both new i18n-sourced labels are forwarded); grep confirms both new enum members and locale keys exist and match.

## 5. Accessibility and RTL

- [x] 5.1 Verify (and add a test asserting) that the new trash/lock icons carry `aria-hidden`, the tooltip's sentence is reachable via the same focus/tooltip mechanism a resolved skill's description already uses, and no keyboard-actionable "View details" control exists when `unresolvedReason` is set — covers the modified Accessibility requirement's two scenarios in `openspec/changes/add-unresolved-skill-indicator/specs/skill-message-payload/spec.md`.
- [x] 5.2 Confirm the new tooltip content uses only logical/direction-agnostic layout (the existing `InteractiveTooltip` placement and `SkillInfoTooltipContent`'s `text-start` already are); no new physical-direction classes are introduced. No RTL-specific code change expected — record this as a checked, not skipped, concern.

Verification: `npm run test:file -- libs/skills/src/components/ChatSkill/tests/ChatSkill.spec.tsx` (extended with the a11y case from 5.1)

## 6. Integration verification

- [x] 6.1 Run `npm run verify:changed` once the vertical slice (Tasks 1–4) is complete, confirming lint/typecheck/affected tests pass across `libs/skills` and `apps/chat`.
- [x] 6.2 Close the change with one `npm run verify:full`.
