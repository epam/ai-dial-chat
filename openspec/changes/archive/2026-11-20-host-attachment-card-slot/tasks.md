# Tasks

Slicing strategy: vertical. Slice 1 delivers the card slot end to end (context, `AttachmentCard`, export, README); slice 2 adds the list hooks one lib at a time, each with its own test; slice 3 checks the architecture guard and RTL. Items marked done are already implemented on branch `feat/attachment-card-slot` and verified as stated; all items are done. Adopting the API in a host (pg-chat) is a separate change in that repository.

## 1. Card slot in `attachment-input`

- [x] 1.1 Move the body of `AttachmentCard` to `libs/attachment-input/src/components/AttachmentCard/TileAttachmentCard.tsx` as `TileAttachmentCard` without editing its JSX, and verify the existing `AttachmentCard.spec.tsx` and `AttachmentCard.interaction.spec.tsx` pass unchanged.
  - Verification: `npm run test:file -- libs/attachment-input/src/components/AttachmentCard/tests/AttachmentCard.spec.tsx libs/attachment-input/src/components/AttachmentCard/tests/AttachmentCard.interaction.spec.tsx`
- [x] 1.2 Add `libs/attachment-input/src/context/AttachmentCardContext.tsx` with `AttachmentCardProvider`, `AttachmentCardProviderProps` and the reader hook (returns `undefined` outside a provider), with JSDoc on every export, and make `AttachmentCard.tsx` render the host component or `TileAttachmentCard`.
  - Verification: `npm run test:file -- libs/attachment-input/src/components/AttachmentCard/tests/AttachmentCard.slot.spec.tsx` covers no provider, provider without a component, host component with every prop forwarded, `AttachmentTray` and `AttachmentGroup` below one provider, and a nested provider without a component restoring the tile.
- [x] 1.3 Export `AttachmentCardProvider` and `AttachmentCardProviderProps` from `libs/attachment-input/src/index.ts`, and verify `npx tsc --noEmit -p libs/attachment-input/tsconfig.lib.json` passes.
- [x] 1.4 Document `AttachmentCardProvider` in `libs/attachment-input/README.md` (props, usage example that compiles, stable component reference, single installed copy), and verify `npm run validate:docs` passes.

## 2. List layout hooks

- [x] 2.1 Add `styles.listClassName` to `AttachmentGroupStyles` (`libs/attachment-input/src/models/attachment-group.ts`) and merge it last into the list classes in `AttachmentGroup.tsx`, and verify the group spec covers the flex row and the 5-column grid being replaced and the existing group specs pass.
  - Verification: `npm run test:file -- libs/attachment-input/src/components/AttachmentGroup/tests/AttachmentGroup.spec.tsx`
- [x] 2.2 Add `listClassName` to `FilesSection` and `styles.filesListClassName` to `ConversationSourcesPanelStyles`, pass it to both sections, and verify the `FilesSection` spec covers the default grid being replaced.
  - Verification: `npm run test:file -- libs/source-panel/src/components/FilesSection/tests/FilesSection.spec.tsx`
- [x] 2.3 Add `styles.listClassName` to `ProjectOutputsStyles` and `styles.contextListClassName` to `ProjectViewStyles` and `ProjectCreateFormStyles`, merged last into the lists in `ProjectOutputs.tsx`, `ProjectView.tsx` and `ProjectCreateForm.tsx`, and verify the outputs spec covers the replacement and the existing project specs pass.
  - Verification: `npm run test:file -- libs/projects/src/components/ProjectOutputs/tests/ProjectOutputs.spec.tsx libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx libs/projects/src/components/ProjectCreateForm/tests/ProjectCreateForm.spec.tsx`
- [x] 2.4 Add `attachmentGroupStyles` to `MessageBubbleStyles` (`libs/conversation-messages/src/models/message-bubble.ts`) and forward it from `UserMessageBubble.tsx` (host `className` merged after `max-w-[640px]`) and `AssistantMessageBubble.tsx`, and verify the bubble spec covers both roles.
  - Verification: `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx`
- [x] 2.5 Add guard tests for the unchanged defaults the spec requires: the user bubble's group keeps `max-w-[640px]` and `ProjectView`/`ProjectCreateForm` context lists keep their default classes when the new options are absent, and verify they pass against the unmodified components.
  - Verification: `npm run test:file -- libs/conversation-messages/src/components/MessageBubble/tests/MessageBubble.spec.tsx libs/projects/src/components/ProjectView/tests/ProjectView.spec.tsx libs/projects/src/components/ProjectCreateForm/tests/ProjectCreateForm.spec.tsx`

## 3. Documentation and architecture guard

- [x] 3.1 Document each option in the README of its lib (`libs/attachment-input`, `libs/source-panel`, `libs/projects`, `libs/conversation-messages`), and verify `npm run validate:docs` passes.
- [x] 3.2 Architecture guard for the touched libs: verify by search that `libs/attachment-input`, `libs/projects`, `libs/source-panel` and `libs/conversation-messages` contain no hardcoded `/api` path, generated-client or server-api import, app context, auth or storage access, feature flag, route knowledge or host name introduced by this change, and that no string in them mentions pg-chat. Record the command and its empty result in the pull request description.
- [x] 3.3 RTL check: verify the diff adds no physical-direction utility (`ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`) in `libs/**`, with `git diff origin/development -- libs | grep -E '^\+.*\b(ml|mr|pl|pr|left|right)-'` returning nothing. No i18n keys are added, so `en.json` is untouched.
