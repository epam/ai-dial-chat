## Context

How the Quick App preview works today:

- `ApplicationFormEditor` owns `isPreviewing` and renders a Preview / Exit preview toggle into `EntityEditor.extraActions` (`apps/chat/src/pages/ApplicationEditor/ApplicationFormEditor.tsx:327-371`). While previewing it passes `hideStandardActions`.
- `QuickAppSetup` renders two absolutely positioned siblings inside the Setup column, `AppEditorIframe` and `AppPreviewChat`, and hides whichever is inactive (`setup/QuickAppSetup.tsx:272-307`). It owns `previewResetKey`, which it bumps on `hasChanges` (`QuickAppSetup.tsx:85, 216, 222`).
- `AppPreviewChat` renders `NewConversationComposer` before the first message and `ConversationView` afterwards, inside a labelled region (`setup/AppPreviewChat.tsx:532-633`). `ConversationView` already centres its content at `max-w-[760px]` and has a `topContent` slot for non-persisted items above the messages (`components/ConversationView/ConversationView.tsx:206-210, 982-985`).
- `EntityEditor` / `EditorLayout` (`libs/builder-form`) render the header, the two columns and a mobile bottom action bar. They don't need any change.

The new design (user-supplied mockup) turns preview into a full-page mode with a Back to setup header, a Preview mode banner, a greeting bubble and a "Send a test message" placeholder. Decisions confirmed with the user:

- the greeting is added on top of the app's starters and intro text, which stay;
- "Back to setup" is the only exit;
- preview remains edit-mode only.

## Goals / Non-Goals

**Goals:**

- Preview takes over the editor page while the editor's state (iframe, unsaved Metadata, readiness) stays alive underneath.
- Leaving and re-entering preview keeps the conversation, and a real configuration change still resets it. This is the existing contract.
- No changes in `libs/*`. Everything stays in `apps/chat`.

**Non-Goals:**

- Preview in create mode, or for custom apps, agents and toolsets.
- Changing the postMessage save protocol, the deployment refetch policy, or the conversation lifecycle.
- Action buttons on the greeting.

## Decisions

### D1. Hide `EntityEditor` instead of unmounting it

While previewing, `ApplicationFormEditor` wraps `EntityEditor` in `<div className={mergeClasses('flex min-h-0 flex-1 flex-col', isPreviewing && 'hidden')} inert={isBusy || isPreviewing}>`. The existing wrapper at line 391 already carries `inert={isBusy}`, so we just extend it.

- Unmounting would remount `AppEditorIframe`, which reloads the embedded editor and loses its unsaved state, and would reset `isSetupReady`.
- `hidden` (`display: none`) on an ancestor of the iframe is already how the preview hides it today, so the iframe is known to tolerate it.
- `inert` keeps the hidden subtree out of the tab order and the a11y tree, even though `display: none` already does this. It is cheap insurance in case the wrapper is ever only visually hidden.
- `hideStandardActions={isPreviewing}` is no longer needed and is dropped.

*Alternative:* add a "preview mode" prop to `EntityEditor`. Rejected because it adds lib API for something a wrapper class already does.

### D2. Make the preview page a definition-supplied `Preview` component rendered by `ApplicationFormEditor`

Add an optional `Preview?: ComponentType<ApplicationPreviewProps>` to `ApplicationEditorDefinition` (`apps/chat/src/models/application-editor.ts`), alongside `Setup`:

```ts
/** Props the page passes to a definition's full-page preview. */
export interface ApplicationPreviewProps {
  /** Id of the edited application. */
  appId: string;
  /** Current Metadata values, read-only. */
  metadata: DeploymentCreationFormValues;
  /** Whether the preview is the visible surface. */
  isVisible: boolean;
  /** Leaves preview and returns to the editor. */
  onExit: () => void;
}
```

`quickAppDefinition.Preview = QuickAppPreview`. `ApplicationFormEditor` renders it as a sibling of the `EntityEditor` wrapper, but only when `isEditMode && definition.Preview`:

```tsx
<div className={mergeClasses('flex min-h-0 flex-1 flex-col', !isPreviewing && 'hidden')} inert={!isPreviewing || isBusy}>
  <Preview key={previewResetKey} appId={appId} metadata={metadata.values} isVisible={isPreviewing} onExit={handleExitPreview} />
</div>
```

- The preview no longer belongs to the Setup column, so it shouldn't be rendered inside it. The page already owns `isPreviewing`, so it now owns the surface as well.
- Keeping it mounted while hidden preserves the session across leaving and re-entering preview. It also keeps today's eager mount (`AppPreviewChat`'s `getDeploymentDetails` prefetch runs once per editor mount, as now).
- `QuickAppPreview` needs the schema `displayName` and `iconUrl` as fallbacks. It reads them the same way `QuickAppSetup` does, from `useDeployments().schemas` plus the `AppsEditorQuery.Schema` search param. Both are host-level values, so this is allowed in an app component.
- `isVisible` exists only so `QuickAppPreview` can manage focus (D5). It doesn't change rendering.

*Alternatives:* a portal from `QuickAppSetup` into a page slot (DOM-node state, and a target change remounts the chat), or a CSS full-screen overlay from inside the Setup column (fights `EditorLayout`'s overflow containers). Both rejected; see the proposal.

### D3. Move ownership of `previewResetKey` up, behind an `onPreviewReset` callback

`ApplicationSetupProps` gains `onPreviewReset: () => void` and loses `isPreviewing`, which nothing else reads (`grep isPreviewing` shows only `ApplicationFormEditor`, the model, `QuickAppSetup` and its spec). `QuickAppSetup` replaces both `setPreviewResetKey(prev => prev + 1)` calls with `onPreviewReset()` and keeps everything else, including the order in `startPreview` (reset, then await `refetchDeployments()`). `ApplicationFormEditor` passes `onPreviewReset={handlePreviewReset}`, a `useCallback` that bumps its own `previewResetKey`.

Effect: the same React batch bumps the key on the same tick as before, so the remounted preview still reads the refetched deployments on its first render.

*Alternative:* have `save`/`startPreview` resolve `{ hasChanges }` and let the page decide. Rejected: `startPreview` must bump before awaiting the refetch, so the result would arrive too late. A callback keeps today's ordering exactly.

### D4. Render the greeting as `AssistantMessageBubble`, outside the message list

`AppPreviewChat` builds one memoised greeting node:

```tsx
<AssistantMessageBubble
  message={{ role: Role.Assistant, content: t(AppsEditorI18nKeys.PreviewGreeting) }}
  deploymentIconUrl={appIconUrl}
  deploymentDisplayName={appDisplayName}
  /* no action callbacks → no action buttons */
/>
```

The exact prop shape must be checked against `libs/conversation-messages/src/models/message-bubble.ts` during implementation. If the bubble can't render without actions, fall back to a small app-level avatar + text row that uses the same avatar component the bubble uses.

- Before the conversation exists, it renders above `NewConversationComposer` inside the existing scroll container, in a `mx-auto w-full max-w-[760px] px-6 pt-7` wrapper that matches `ConversationView`'s column.
- After the conversation exists, it goes through `ConversationView topContent={greeting}`. That slot is documented as "never persisted as a message", which is exactly the guarantee we need, and it keeps the greeting out of `messages` indexes, so delete, edit and regenerate indexes are unaffected.

*Alternative:* inject a synthetic assistant message into `conversation.messages`. Rejected because it would be sent to the model and would shift every message index.

### D5. Focus management

`QuickAppPreview` holds a ref to the Back to setup button and focuses it in an effect when `isVisible` turns `true`. `ApplicationFormEditor` holds a ref to the Preview `GhostButton` and focuses it in a `useEffect` that runs when `isPreviewing` goes from `true` to `false`. It can't happen inside `handleExitPreview`, because the wrapper must be un-hidden first. Without this, focus would be lost on `<body>` when the focused element gets `display: none`.

If `GhostButton` doesn't forward a ref (check with the ui-kit MCP `getEntityDetails`), focus the first focusable element inside a wrapper `div` ref instead.

### D6. Banner styling and copy

- Strip: full width, `px-4 py-2`, logical spacing only, theme tokens for background and border (the accent-tinted layer token from the kit's colour tokens, picked via MCP, with no hex values), text `dial-small-text text-primary`.
- Label: `dial-tiny-lead-semi-text text-accent-primary`. The `*-lead-*` class uppercases it, so the i18n value stays sentence case ("Preview mode").
- Bold app name: `Trans` with `components={{ bold: <strong className="font-semibold" /> }}`. *(Typography note: `font-semibold` inside running text is an app-level emphasis, not a lib scale class, so it is allowed here.)*
- The copy follows the mockup word for word, including "Usage is following your limits." See Open Questions.

### D7. Header row

A plain app-level row, `flex items-center gap-2 border-b px-4 py-2 desktop:px-8`, with one `GhostButton`. It looks like `EditorLayout`'s header row, but it is not reused, because `EditorLayout` requires a title, columns and actions that the preview doesn't have.

## Loading, empty and error states

- **Loading:** unchanged. The saving overlay covers the page while `startPreview` runs, and `AppPreviewChat` shows its centred `Spinner` until the app resolves. The header and banner render immediately, because they need only Metadata values.
- **Empty:** greeting + composer + starters (D4).
- **Error:** a preview-save error keeps the user in the editor with the inline Setup error (unchanged). Chat errors use `ConversationView`'s existing handling.

## Risks / Trade-offs

- [`display: none` on a parent of the iframe while preview is open for a long time] → This is already the current behaviour, and no reload has been observed.
- [`AssistantMessageBubble` may require action or label props that make an action-less, static bubble awkward] → D4's fallback: an app-level avatar + text row that uses the same avatar component.
- [Two hidden-but-mounted trees (editor and preview) double the DOM] → Both were already mounted together before (iframe and chat inside Setup), so the cost is unchanged.
- [Removing `exitPreview` / `ExitPreviewButton` and `isPreviewing` from Setup props] → Internal to `apps/chat`, and the compiler flags every call site. Other locale JSONs don't carry the key today (grep: en.json only).
- [Focus restore timing] → Restore in an effect after the un-hide render, not inside the click handler.

## Migration Plan

Frontend only, one PR, nothing persisted. Rollback = revert the commit.

## Open Questions

- Copy: "Usage is following your limits." reads unnatural. A suggested replacement is "Usage counts toward your limits." It is kept as in the mockup until product or design confirms.
- The mockup shows two icons under the greeting. The plan treats them as a mockup artifact (no actions). Revisit if design intends them.
- Exact banner background and border tokens: confirm against Figma if a link becomes available.
