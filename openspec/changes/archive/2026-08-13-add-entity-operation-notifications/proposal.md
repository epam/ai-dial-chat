# Add success notifications for entity operations

## Why

Success feedback after a user-initiated operation is inconsistent. Some operations confirm themselves, several complete in total silence — downloading a prompt, saving an agent / quick app / custom app / toolset, duplicating or renaming a conversation, renaming a file, creating a folder — and the ones that do notify use unrelated wording (`"Published"`, `"Deleted successfully"`, `"Prompt saved"`, `"Item deleted successfully"`). The design for prompts (created / edited / deleted / downloaded / published / unpublished) settles the pattern: a `<Entity> <operation> successfully` title plus one sentence naming the entity and, where relevant, the target folder. This change applies that pattern to every entity operation the app already performs, so a completed action is always confirmed and always reads the same way.

## What Changes

- Introduce a single app-level contract for **operation success notifications**: one success notification per completed user-initiated operation, with a title of the form `<Entity> <operation> successfully` and a body sentence that names the entity in quotes (and the folder for publish/unpublish).
- **Add missing success notifications**:
  - Prompt download (catalog details) — currently only the failure path notifies.
  - Agent / quick app create and save (`AppsEditor`), custom app create and save (`CustomAppEditor`), toolset create and save (`ToolsetEditor`) — today these navigate away silently.
  - Conversation duplicate and rename (`ConversationPanelView`) — today only failures notify.
  - File / folder rename, folder creation, and file download (file manager) — today only failures notify.
- **Unify the copy of the notifications that already exist** to the same pattern: prompt create/edit/delete/publish, catalog delete/unshare/revoke, conversation delete/delete-all/export/import/publish/unshare/revoke, file upload/delete/copy/move.
- Add explicit i18n keys per `(entity, operation)` pair in one `entityNotifications` namespace instead of composing a sentence at runtime from an entity noun — grammatical composition breaks in gendered/cased locales and is unsafe for the mandated Arabic/RTL support. Batch copy (export all, import, multi-item file operations) keeps its existing keys and only gets a realigned title.
- **Correct the publish copy**: both publish flows create an admin-pending DIAL Core publication, so the notification says a publish request was submitted and appears once an admin approves it. The catalog notification currently claims `"\"{{name}}\" published to {{folder}}"`, which overstates the outcome; the conversation notification already carries approval-aware copy. This is a deliberate deviation from the mockup's `"is published to folder"` wording — flagged for design review in `design.md`.
- Specify the **unpublish** notification as part of the contract, but do not implement it: no unpublish endpoint exists in `@epam/chat-api-client` and no unpublish action exists in the UI. The requirement stands so the notification lands with the action when it is built.
- Error notifications are untouched: variant, `requestId`/trace-id behavior, and the offline branch stay exactly as they are.

**Non-goals**

- Implementing the unpublish operation itself (backend, API client, catalog action, confirmation).
- Notifying on conversation creation — a new chat is created constantly, so a toast per creation is noise.
- Scheduled tasks (create/update/pause/resume already notify; delete is left as-is by decision).
- Changing the notification component, its placement, auto-dismiss timing, or the `Request ID` row.

## Capabilities

### New Capabilities

- `entity-operation-notifications`: the cross-cutting contract — which operations must raise a success notification, the title/body shape per `(entity, operation)` pair, the i18n key layout, the variant and dismissal rules, and the app-level helper every call site uses. Also records the unpublish requirement as specified-but-unimplemented.

### Modified Capabilities

- `file-manager-download`: the download algorithm currently notifies only on failure; a success notification is added on completion.
- `file-manager-folder-creation`: folder creation currently notifies only on failure; a success notification is added.
- `file-manager-rename-ui`: rename currently notifies only on total/partial failure; a success notification is added for a fully successful rename.
- `toolset-authoring`: a successful create/save currently just navigates back; it must also notify.
- `custom-app-editor`: a successful create/save currently just navigates back; it must also notify.
- `quick-app-authoring`: a successful create/save currently just navigates back; it must also notify.
- `catalog-publish-flow`: the publish success notification moves to the shared helper and its copy becomes approval-aware, replacing the `CatalogI18nKeys.PublishSuccess*` pair.

## Impact

**Frontend (`apps/chat`)**

- New helper + keys: `apps/chat/src/hooks/` (notification helper built on `useNotification`), `apps/chat/src/constants/translation-keys.ts`, `apps/chat/src/i18n/locales/en.json`.
- Call sites: `components/CatalogView/CatalogView.tsx`, `pages/PromptEditor/PromptEditor.tsx`, `pages/AppsEditor/AppsEditor.tsx`, `pages/ToolsetEditor/ToolsetEditor.tsx`, `pages/ToolsetEditor/CustomAppEditor.tsx`, `components/ConversationPanel/ConversationPanelView.tsx`, `hooks/files/useDialFileMutations.ts`, `hooks/useConversationExport.ts`, `hooks/useConversationImport.ts`, `components/PublishConversationPanelContainer/PublishConversationPanelContainer.tsx`.
- Tests: the specs of the touched components/hooks assert notification payloads; existing assertions on reworded strings and on newly notifying paths need updating.

**Libraries (`libs/*`)**

- No new library knowledge. `libs/catalog` and the file-manager lib keep receiving operation callbacks (`onDownload`, `onDelete`, `onNotification`, …) from the app; every notification decision and every translated string stays in `apps/chat`, per the library isolation rule.

**Backend**

- None. No endpoint changes; unpublish stays unimplemented.
