## 1. Click-triggered mention contract

- [x] 1.1 Extend `libs/skills/src/models/chat-skill-props.ts` with the optional, backward-compatible details-trigger contract and update `libs/skills/src/components/ChatSkill/ChatSkill.tsx` so click mode controls the existing `InteractiveTooltip`, opens it on click/Enter/Space, and preserves its dismissal and details-button behavior. Keep the library free of app contexts, routing, API clients, feature flags, and host details-panel knowledge. Verification: add/update `libs/skills/src/components/ChatSkill/tests/ChatSkill.spec.tsx` and run `npm run test:file -- libs/skills/src/components/ChatSkill/tests/ChatSkill.spec.tsx`.

## 2. Conversation-input integration

- [x] 2.1 Add the optional active-mention trigger setting to `libs/skills/src/models/skill-selector-overlay.ts` and forward it only from `libs/skills/src/hooks/useSkillSelectorOverlay/useSkillSelectorOverlay.tsx` to live `activeMentions`; retain the hover default for history renderers. Verification: update `libs/skills/src/hooks/useSkillSelectorOverlay/tests/useSkillSelectorOverlay.spec.tsx` and run `npm run test:file -- libs/skills/src/hooks/useSkillSelectorOverlay/tests/useSkillSelectorOverlay.spec.tsx`.
- [x] 2.2 Keep `apps/chat/src/components/SkillSelector/useSkillSelectorOverlay.tsx` on the default hover trigger, without changing skill-menu row selection or the injected details-panel ownership. Verification: update `apps/chat/src/components/SkillSelector/tests/useSkillSelectorOverlay.spec.tsx` and run `npm run test:file -- apps/chat/src/components/SkillSelector/tests/useSkillSelectorOverlay.spec.tsx`.

## 3. Verification

- [x] 3.1 Run `npm run verify:changed` after the completed vertical slice; address regressions limited to the change and preserve the existing published-library default behavior.
- [x] 3.2 Run `npm run verify:full` once after all tasks complete.
