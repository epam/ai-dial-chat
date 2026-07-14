# Manual QA test cases — Catalog publish to folder

**OpenSpec:** `openspec/changes/add-catalog-publish-to-folder/`
**Surface under test:** Catalog details panel Publish flow (`PublishPanel`, `PublishFoldersTree`, `PublishHistoryList`), the `apps/chat/src/hooks/catalog/useCatalogPublishFolders.ts` folder-tree hook, and the `apps/chat-api/src/publish/` backend module (proxies DIAL Core's Publication API — `createPublication`/`getPublications`).

---

## Prerequisites

| #   | Requirement                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Branch checked out; BFF (`apps/chat-api`) + chat app running locally against a DIAL Core instance that supports the Publication API                                                                                  |
| P2  | Authenticated, non-admin user who owns at least one Toolset or Application catalog item (`isMyApp: true`)                                                                                                            |
| P3  | A second Toolset/Application item **not** owned by the current user, to verify Publish stays hidden                                                                                                                  |
| P4  | Write access to at least one Organization/public folder; a second folder the user does **not** have write access to, if the Core environment supports per-folder restricted access                                   |
| P5  | An entity already published once, to exercise the replace-warning path                                                                                                                                               |
| P6  | Browser: Chrome (primary); optional Firefox/Safari spot check                                                                                                                                                        |
| P7  | RTL pass: switch UI to Arabic (`ar`) if available, or force `dir="rtl"` via devtools, for layout smoke tests (see Slice 1 below — no Arabic translations exist for the new strings yet, this is a layout-only check) |

---

## How to open the Publish flow

1. Open the Catalog, click into a Toolset or Application item you own.
2. Confirm the **Publish** button is visible in the details header.
3. Click **Publish** — the panel should slide to the publish view (back chevron + "Publish" title).

---

## Slice 1 — Folder tree (`PublishFoldersTree` / ui-kit `DialFoldersTree`)

### TC-1.1 Folder tree renders and expands

| Field        | Value                                                                                                                                                                         |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Open Publish → observe root-level Organization folders → expand a folder with children                                                                                        |
| **Expected** | Root folders render immediately (from `useCatalogPublishFolders`' initial fetch); expanding a folder triggers a lazy load (brief loading affordance) and reveals its children |

### TC-1.2 Single-folder selection

| Field        | Value                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Click a folder row → click a different folder row → click the currently-selected folder row again                                                                      |
| **Expected** | Selecting a folder highlights only that row; selecting another folder moves the highlight; clicking the already-selected folder deselects it (Publish button disables) |

### TC-1.2b Bucket root selection

| Field        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Open the publish panel → click the "Organization" node at the top of the folder tree → click a folder row → click "Organization" again                                                                                                                                                                                                                                                                                                                                                               |
| **Expected** | "Organization" is a node in the tree (like the file manager's own root), always shown expanded so its children (top-level folders) are visible below it; clicking it highlights it as selected; the folder history section appears for the root the same as for any folder; selecting a folder afterward moves the highlight off the root node; re-selecting the root moves it back and clears the folder highlight; the Publish button always reads just "Publish", never "Publish to Organization" |

### TC-1.3 Folder search

| Field        | Value                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Steps**    | Type a partial folder name into the search box above the tree                                                                                                                  |
| **Expected** | Tree filters to matching folders (and their ancestors); clearing the search restores the full tree; searching for a non-existent name shows the "No folders match" empty state |

### TC-1.4 Inline folder creation

| Field        | Value                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Select a parent folder → click "Create new folder" → type a name → confirm                                                                                                                                |
| **Expected** | New folder appears under the parent immediately (optimistic) and becomes selected; a real `createFolder` BFF call fires in the Network tab targeting the Organization bucket                              |
| **Notes**    | Creating a **root-level** folder (no parent selected) may fail if the hook cannot resolve a bucket from an empty root listing — see design.md's Open Questions; check for a graceful failure, not a crash |

### TC-1.5 Duplicate folder name rejected

| Field        | Value                                                                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Steps**    | Try to create a folder with the same name as an existing sibling                                                                                                                                                                     |
| **Expected** | Creation is silently rejected (no duplicate node appears, no `onCreateFolder` call) — current UX has no inline error message for this case (a known gap; the ui-kit tree has no create-time validation hook, only a rename-time one) |

### TC-1.6 RTL layout

| Field        | Value                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **Steps**    | Switch direction to RTL → reopen Publish                                                                   |
| **Expected** | Tree, search box, and create-folder row mirror correctly; chevrons flip; no visual overlap or clipped text |

---

## Slice 2/3 — Real folder data, publish, and history (DIAL Core Publication API)

### TC-2.1 Publish succeeds

| Field             | Value                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Preconditions** | User has write access to the selected folder                                                                                                                                                                       |
| **Steps**         | Select a destination folder → click **Publish**                                                                                                                                                                    |
| **Expected**      | Button shows a loading state; on success, the panel closes, a success toast appears ("published to {folder}"), and a `POST /api/v1/catalog/{entityType}/{entityId}/publish` call succeeds (201) in the Network tab |

### TC-2.2 Publish to a folder without write access

| Field             | Value                                                                                                                                                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions** | A folder the user cannot write to (per Core's actual permissions — the client-side heuristic in `useCatalogPublishFolders` only denies folders containing "Production" as a placeholder, so use that folder name, or a Core-enforced restricted folder if available) |
| **Steps**         | Select that folder → click Publish                                                                                                                                                                                                                                   |
| **Expected**      | The panel shows a no-access error callout before/after submit; a 403 from Core maps to the callout, not a silent failure                                                                                                                                             |

### TC-2.3 Replace-warning for an already-published version

| Field             | Value                                                                                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preconditions** | Entity already published at this version to the selected folder (per P5)                                                                                        |
| **Steps**         | Select that folder                                                                                                                                              |
| **Expected**      | A warning callout appears ("Version X is already published in {folder}. Publishing will replace it.") and the submit button reads "Update" instead of "Publish" |

### TC-2.4 Publish history loads and updates

| Field        | Value                                                                                                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Open Publish for an entity with prior publish history → select the folder it was published to                                                                                                                                                           |
| **Expected** | A brief loading message appears, then the version history list populates (most recent first); after a successful new publish, reopening Publish and reselecting the folder shows the new entry at the top (server-side cache is invalidated on publish) |

### TC-2.5 History load failure

| Field        | Value                                                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Simulate a backend failure for the history endpoint (e.g. stop `apps/chat-api` or block the request in devtools) → open Publish → select a folder        |
| **Expected** | The history section shows an error message ("Failed to load publish history.") instead of hanging on the loading state or silently showing an empty list |

### TC-2.6 Publish button visibility

| Field        | Value                                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Steps**    | Open details for an entity you own (Toolset/Application) vs. one you don't own vs. a built-in Model                                                 |
| **Expected** | Publish shows only for owned Toolset/Application items; hidden for non-owned items and for entity types the backend does not support publishing for |

---

## Known gaps / out of scope for this pass

- No Arabic (or any non-English) locale exists in the app yet, so the new Publish strings are English-only; only layout/RTL is testable, not translated copy.
- `hasPublishWriteAccess`'s "Production" folder-name heuristic is a placeholder pending a real DIAL Core permission-check contract (see design.md Open Questions) — it will not match real Core folder permissions in all environments.

## Fixed since initial implementation (verify these specifically)

- **Expand-to-fetch wiring**: clicking a folder to expand it previously did nothing — `useCatalogPublishFolders`'s fetch-triggering `onExpandedPathsChange` was never threaded past `CatalogView`. Fixed by adding controlled `expandedPaths`/`onExpandedPathsChange`/`loadingPaths` props all the way through `PublishFoldersTree` → `PublishPanel` → `DetailsPanel` → `Catalog` → `CatalogView`. **Retest TC-1.1 explicitly** — expanding a folder with unfetched children must show a brief loading state and then reveal them.
- **Publish 400 on nested folders**: publishing to a folder produced `DIAL Core returned 400` because `targetUrl` was built by appending the entity's _full_ resource path (e.g. `applications/{bucket}/{name}`) onto the destination folder, instead of just the resource's own name. Fixed in `catalog-publish.service.ts`.
- **Publish still 400'd — missing "public" bucket segment**: even after the fix above, publishing kept failing because `targetFolder`/`targetUrl` carried no bucket identity at all — DIAL Core addresses the shared Organization/public area via the literal segment `public` (confirmed against the legacy pre-BFF frontend), not an opaque bucket id.
- **Publish still 400'd a third time** — Core's rejection was `Publication "targetUrl" must start with: public and ends with: /`, initially (incorrectly) read as "`targetUrl` must be folder-shaped". That fix produced a _different_ 400 on the next live attempt (`Bad resource url: public/{folderPath}`).
- **Root-caused against DIAL Core's own published OpenAPI spec** (https://dialx.ai/dial_api#tag/Publications/operation/createPublication): the documented example for `createPublication` is `targetFolder: public/folder/` (trailing slash **required**) and `targetUrl: conversations/public/folder/conversation` (a full file path — resource-type prefix + folder + resource name, **no** trailing slash). The real bug was a missing trailing slash on `targetFolder`; `targetUrl` needed the resource-type prefix and name all along. Fixed to match the spec exactly. **Retest TC-2.1 explicitly with a nested destination folder** (e.g. "Parent/Child") against a real DIAL Core instance — this version is grounded in Core's own spec, not trial-and-error, so it should be the one that finally succeeds end-to-end. `apps/chat-api`'s debug-level logs (`createPublication request body` / `error body`) are still in place if it doesn't.
- Root-level folder creation may not resolve a bucket if no root folders have loaded yet (see TC-1.4 notes).
- **Cannot choose the bucket root as a publish destination**: `selectedFolderPath: []` was previously treated as "nothing selected" everywhere (`Boolean(path?.length)`), so the root of the Organization/public tree had no way to be selected even though it is a valid destination (Core's own `public/` root case). Redesigned the sentinel so `undefined` means nothing selected and `[]` means the root is explicitly selected. Initially added a separate "Organization root" button above the tree; corrected per feedback to match the file manager's own pattern — the root ("Organization") is now a real, always-expanded node _inside_ the tree, not a control outside it. **Retest TC-1.2b explicitly** — publishing directly to the root, and the write-access/replace-warning callouts using "Organization" as `{folder}` when the root is selected.
- **Publish button overflowed for long destination names**: the submit button read "Publish to {folder}", which overflowed for long folder/entity names. It now always reads plain "Publish" (or "Update version {version}" when replacing), never the destination name. **Retest**: select a folder with a long name and confirm the Publish button still reads just "Publish".
- **Publish succeeded but the request title was wrong**: publish requests returned `201`, but the DIAL Core admin request list showed the bare version number (e.g. `"0.0.1"`) as the request title instead of a readable name. Fixed: the title is now `"{entity name} {version}"` (e.g. `"My App Name 0.0.1"`), with the caller's display name sent separately as `displayAuthor` (not embedded in the title). **Retest TC-2.1 explicitly, checking the DIAL Core admin request list**: the new publication request should show a readable title like "My App Name 0.0.1", and the request's author should show your display name (not blank, not the version).
