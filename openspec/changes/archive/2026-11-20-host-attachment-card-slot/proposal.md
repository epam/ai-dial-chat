## Why

Every attachment in the chat is drawn by `AttachmentCard` as a 100 × 100 square tile (`libs/attachment-input/src/constants/attachment-group.ts:4`), and every list that holds those tiles fixes its own layout: a wrapping flex row or a 5-column grid in `AttachmentGroup` (`AttachmentGroup.tsx:153-156`), an auto-fill grid in `FilesSection`, a flex row in `ProjectOutputs`, `ProjectView` and `ProjectCreateForm`. A host that embeds these libs and has its own design for attachments (pg-chat wants a horizontal 58 px card with an icon, name and type line, actions that overlay the content on hover, and 2, 3 or 4 full-width columns depending on the screen) can only recolour the square tile through `styles.colors` and public class names. It cannot change the card's structure or the column layout of a list, and the libs do not know which host asks.

The shape of the card is a host decision, not a lib one, so it must be a seam in the lib rather than a second look shipped to every host.

## What Changes

- **Card slot.** `@epam/ai-dial-attachment-input` exports `AttachmentCardProvider` with an optional `component?: ComponentType<AttachmentCardProps>`. `AttachmentCard` reads it from a React context and renders the host's component with the same props, otherwise the built-in tile. The built-in tile moves unchanged into `TileAttachmentCard`.
  Every `AttachmentCard` below the provider is replaced at once: the composer tray, message groups, and the lists in `projects`, `source-panel` and `conversation-stages`, without those libs naming the host.
- **List layout hooks.** Each list that holds attachment cards accepts a class name merged after its default layout classes, so a host sets the columns:
  - `AttachmentGroup`: `styles.listClassName`.
  - `UserMessageBubble`, `AssistantMessageBubble`: `styles.attachmentGroupStyles` (forwarded to the message's `AttachmentGroup`; its `className` is merged after the user bubble's `max-w-[640px]`).
  - `FilesSection`: `listClassName`; `ConversationSourcesPanel`: `styles.filesListClassName`.
  - `ProjectOutputs`: `styles.listClassName`; `ProjectView` and `ProjectCreateForm`: `styles.contextListClassName`.
- READMEs of the four libs document the new API.
- Nothing changes for a host that mounts no provider and passes none of the new options: same DOM, same classes, same behaviour. No **BREAKING** change.

Non-goals:

- Shipping a second built-in card (row or compact variant) in the lib.
- Any change to `apps/chat`; it keeps the square tile.
- A column-count prop or a responsive grid in the libs; layout stays a class-name concern of the host.
- Extracting the card's accessibility logic (overlay button, `aria-pressed`, live-region error) into a shared hook. A host's card owns its accessibility; revisit if hosts start duplicating it.
- The pg-chat card and its layout constants (a host change, outside this repository).

## Capabilities

### New Capabilities

- `attachment-card-host-slot`: `AttachmentCardProvider` and the rule that `AttachmentCard` renders the host's component, or the built-in tile when none is supplied.
- `attachment-list-layout-hooks`: the class-name options that let a host change the column layout of every list holding attachment cards, and how they combine with each list's defaults.

### Modified Capabilities

None. The existing `attachment-input-lib`, `project-view-ui`, `project-create-ui`, `project-edit-ui`, `conversation-sources-sidebar` and `message-bubble-attachment-click` requirements are not altered: every new option is additive and absent-by-default.

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **A. Do nothing; host restyles through `styles.colors` and public class names (`dial-ai-attachment-tile*`).** Conservative baseline. | Rejected. The tile is a vertical 100 px square with a corner action row; a horizontal card with a different DOM order and a 32 px icon box cannot be produced from CSS hooks without fighting the lib's layout utilities, and every Tailwind change in the lib would break the override. |
| **B. A `variant` prop (`tile` / `row`) on `AttachmentCard`, with the row card built into the lib.** | Rejected. Both looks ship to every host (JS and CSS; tree-shaking cannot help because the choice is made at runtime), each new look adds another variant, and the lists that render the card internally need the prop threaded through `projects`, `source-panel`, `conversation-messages` and `conversation-stages`. |
| **C. A `renderCard` prop on every consumer (`AttachmentGroup`, `ProjectView`, `ProjectCreateForm`, ...).** | Rejected. Seven props in five libs to say one thing, and a new consumer would silently ignore the host's card. |
| **D. A context-provided card component in the one place every consumer already goes through (`AttachmentCard`), plus class-name hooks for layout.** | Chosen. One extension point; the default path costs one `useContext` per card; hosts own their card and its code, so ai-dial-chat carries no host-specific look. |

## Impact

- `libs/attachment-input`: new `src/context/AttachmentCardContext.tsx`; `AttachmentCard.tsx` reads the context; the previous body moves to `TileAttachmentCard.tsx`; `AttachmentGroup.tsx` and `models/attachment-group.ts` gain `listClassName`; `index.ts` exports `AttachmentCardProvider` and `AttachmentCardProviderProps`; README.
- `libs/projects`: `ProjectOutputs`, `ProjectView`, `ProjectCreateForm` and their `models/*-props.ts`; README.
- `libs/source-panel`: `FilesSection`, `ConversationSourcesPanel`, `models/conversation-sources-panel-props.ts`; README.
- `libs/conversation-messages`: `UserMessageBubble`, `AssistantMessageBubble`, `models/message-bubble.ts`; README.
- Public API of four published libs grows (additive). Host integration stays outside the lib boundary: the host passes its card as `component` and its columns as class names; the libs hold no knowledge of any host.
- **Shared libs and global providers.** The change touches shared libs but adds no provider to `apps/chat` and no new shared state: the context holds one optional component and is read only by `AttachmentCard`. The closest existing model is `libs/quotations/src/context/CitationCardContext.tsx:5-7`, a lib-local context with a provider export and a consumer hook.
- i18n: no new user-visible strings; labels still arrive through the existing `labels` props.
- Docs: four lib READMEs; `npm run validate:docs` and `npm run validate:specs`.

## Acceptance criteria

- With no provider and none of the new options, every affected component renders the same DOM and classes as before (existing suites of `attachment-input`, `projects`, `source-panel`, `conversation-messages` pass unchanged).
- With a provider, the host's component renders in `AttachmentCard` directly, inside `AttachmentTray` and `AttachmentGroup`, with every prop forwarded; a nested provider without `component` restores the built-in tile.
- Each list option replaces the default layout classes it conflicts with (`grid grid-cols-3` replaces `flex`) and leaves the rest.
- `tsc`, ESLint, Prettier and `npm run validate:docs` pass for the four libs.

## Rollback and compatibility

Not breaking: all additions are optional props or a provider the host opts into. To revert, remove the context file and the `AttachmentCard` indirection, restore `TileAttachmentCard.tsx` as `AttachmentCard.tsx`, and drop the class-name options; hosts that adopted them fall back to the built-in tile and the default layouts. A host must keep one installed copy of `@epam/ai-dial-attachment-input` (libs pin the exact version), otherwise a provider mounted in the host does not reach cards rendered inside the other libs.

## Assumptions

- The first consumer is pg-chat, which already runs the change locally against built `dist` output of the four libs.
- Only `AttachmentCard` is replaceable; the drag-and-drop overlay and tray container stay as they are.
- The implementation exists on branch `feat/attachment-card-slot`; the tasks record it and what is left (release and host adoption).
