# DIAL File Manager — legacy modal parity gap matrix

Living reference: **`DialFileManagerModal` + `useDialFileManager`** vs legacy **`FileManagerModal` + `useFileManager`**.

|       |              Legacy modal               |   Legacy page   |           Current            |
| ----- | :-------------------------------------: | :-------------: | :--------------------------: |
| Hook  |        `useFileManager` (Redux)         |      same       | `useDialFileManager` (local) |
| API   | legacy `/api/listing`, `/api/files/...` |      same       |    BFF `/api/v1/files/*`     |
| Shell |         `Modal` + Attach footer         | full page route | `DialPopup` + Attach footer  |

**Legend — Current:** ✅ done · ⚠️ partial · ❌ missing

**Legend — Spec:** ✅ archived · 🔄 active · — planned

**Last updated:** after `add-file-manager-delete` implementation (OpenSpec archived `2026-06-20-add-file-manager-delete`).

---

## Table 3 — Full gap matrix

| #                       | Feature                                         | Legacy modal | Legacy page | Current |                       Spec                        | Priority | Next change                                                                                       |
| ----------------------- | ----------------------------------------------- | :----------: | :---------: | :-----: | :-----------------------------------------------: | :------: | ------------------------------------------------------------------------------------------------- |
| **Attach & selection**  |
| 1                       | `allowedFileTypes` filtering (grid + attach)    |      ✅      |     ✅      |   ✅    |  ✅ `2026-06-19-dial-file-manager-attach-parity`  |    —     | Done                                                                                              |
| 2                       | Max file size on selection                      |      ✅      |      —      |   ✅    |                 ✅ attach-parity                  |    —     | Done                                                                                              |
| 3                       | Max attachments count + error toast             |      ✅      |      —      |   ✅    |  ✅ attach-parity (+ BFF `maxInputAttachments`)   |    —     | Done                                                                                              |
| 4                       | Hidden paths not selectable + tooltip           |      ✅      |     ✅      |   ✅    |                 ✅ attach-parity                  |    —     | Done                                                                                              |
| 5                       | Header: size / types / count limits             |      ✅      |      —      |   ✅    |                 ✅ attach-parity                  |    —     | Done                                                                                              |
| 6                       | Attach folders                                  |      ✅      |      —      |   ⚠️    |                 ✅ attach-parity                  |  **P1**  | Wire `canAttachFolders` at call sites; consume `folderPaths` in attach/send flow (modal logic ✅) |
| **Navigation & browse** |
| 7                       | Tabs (My / Shared / Org / Review)               |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | `dial-file-manager-modal-parity`                                                                  |
| 8                       | Tab-specific filters & upload rules             |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | modal-parity                                                                                      |
| 9                       | Search (`onSearchFiles`, recursive listing)     |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | `dial-file-manager-browse-ux`                                                                     |
| 10                      | Tree `expandedPaths` / `loadedPaths`            |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | browse-ux                                                                                         |
| 11                      | Grid columns (Name, UpdatedAt, Size, Actions)   |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | browse-ux                                                                                         |
| 12                      | List pagination (`token`)                       |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | browse-ux                                                                                         |
| 13                      | `sharedWithMeIds` / Author column               |      ✅      |     ✅      |   ❌    |                         —                         |  **P2**  | modal-parity (needs Shared tab)                                                                   |
| **Transfer actions**    |
| 14                      | Upload files                                    |      ✅      |     ✅      |   ✅    | ✅ `2026-06-19-add-file-manager-transfer-actions` |    —     | Done                                                                                              |
| 15                      | Upload progress (legacy bar + summary + Cancel) |      ✅      |     ✅      |   ✅    |                ✅ transfer-actions                |    —     | Done                                                                                              |
| 16                      | Create folder                                   |      ✅      |     ✅      |   ✅    |                ✅ transfer-actions                |    —     | Done                                                                                              |
| 17                      | Download file / archive                         |      ✅      |     ✅      |   ✅    |                ✅ transfer-actions                |    —     | Done                                                                                              |
| 18                      | Upload archive (ZIP extract)                    |      ✅      |     ✅      |   ❌    |                         —                         |  **P2**  | `dial-file-manager-upload-archive`                                                                |
| 19                      | Upload conflict UI (replace/duplicate)          |      ✅      |     ✅      |   ✅    |      ✅ `add-file-manager-upload-conflicts`       |    —     | Done — conflict popup, filename sanitization, overwrite/create-only BFF mode                      |
| 20                      | `autoSelectUploadedItems`                       |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | modal-parity                                                                                      |
| **CRUD & metadata**     |
| 21                      | Rename (+ validation)                           |      ✅      |     ✅      |   ❌    |                         —                         |  **P1**  | modal-parity + BFF                                                                                |
| 22                      | Delete / bulk delete                            |      ✅      |     ✅      |   ⚠️    |      ✅ `2026-06-20-add-file-manager-delete`      |  **P1**  | Close delete slice: WRITE-gated action labels (see notes)                                         |
| 23                      | Move / Copy (+ destination popup)               |      ✅      |     ✅      |   ❌    |                         —                         |  **P2**  | `dial-file-manager-crud`                                                                          |
| 24                      | Share / Unshare                                 |      ✅      |     ✅      |   ❌    |                         —                         |  **P2**  | sharing                                                                                           |
| 25                      | File metadata popup (`onGetInfo`)               |      ✅      |     ✅      |   ❌    |                         —                         |  **P2**  | metadata UI (BFF `GET metadata` exists)                                                           |
| 26                      | Row click / preview                             |  ✅ (stub)   |     ✅      |   ❌    |                         —                         |  **P3**  | optional                                                                                          |
| **UX polish**           |
| 27                      | `OperationLoaderModal` (copy/move/create)       |      ✅      |     ✅      |   ⚠️    |                         —                         |  **P1**  | modal-parity (download/delete use inline overlay)                                                 |
| 28                      | Global operation blackout                       |      ✅      |     ✅      |   ⚠️    |                         —                         |  **P2**  | crud (partial: upload/download/delete/folder block Attach)                                        |
| 29                      | Success/error toasts (upload/folder)            |      ✅      |     ✅      |   ⚠️    |                         —                         |  **P2**  | polish (attach/delete toasts ✅; download/folder inline banner)                                   |
| 30                      | `translateFileManagerChrome`                    |      ✅      |     ✅      |   ❌    |                         —                         |  **P3**  | i18n follow-up                                                                                    |
| 31                      | `additionalFilesAndFolders` injection           |      ✅      |     ✅      |   ❌    |                         —                         |  **P3**  | edge case                                                                                         |
| **Shell**               |
| 32                      | Modal header with attach constraints            |      ✅      |      —      |   ✅    |                 ✅ attach-parity                  |    —     | Done                                                                                              |
| 33                      | Standalone FM route / layout                    |      —       |     ✅      |   ❌    |                         —                         |  **P3**  | separate product decision                                                                         |

---

## Shipped slices (summary)

| OpenSpec change                                | Status      | Covers rows        |
| ---------------------------------------------- | ----------- | ------------------ |
| `2026-06-19-add-file-manager-transfer-actions` | ✅ archived | 14–17, 15          |
| `2026-06-19-dial-file-manager-attach-parity`   | ✅ archived | 1–5, 32; partial 6 |
| `2026-06-20-add-file-manager-delete`           | ✅ archived | 22 (core delete)   |
| `add-file-manager-upload-conflicts`            | ✅ shipped  | 19                 |

---

## Partial implementations (detail)

| Feature                    | What works                                                                                                                                                                                  | What is missing                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Attach folders (#6)**    | `canAttachFolders`, dedup, `AttachResult.folderPaths` in modal                                                                                                                              | Call sites default `canAttachFolders={false}`; send path ignores `folderPaths`                                             |
| **Delete (#22)**           | `POST /api/v1/files/delete`; `onDeleteFiles`; bulk + grid + tree Delete; confirmation popup; loader + error banner; cache invalidation; navigate on folder delete; partial-failure messages | Delete action labels always shown — spec calls for hiding Delete when current folder lacks WRITE (`canWriteCurrentFolder`) |
| **Operations UX (#27–28)** | Per-operation overlays for download/delete/upload                                                                                                                                           | No unified `OperationLoaderModal`; no copy/move/delete global blackout                                                     |
| **Permissions**            | WRITE → disable Upload/New + tooltip                                                                                                                                                        | Delete not hidden on read-only folder (403 → partial failure instead)                                                      |

---

## Priority backlog (PO)

| Priority      | Goal                            | Rows                           |
| ------------- | ------------------------------- | ------------------------------ |
| **Close now** | Archive / verify shipped slices | 1–5, 14–17, 22 (core)          |
| **P1**        | Modal parity + browse           | 6–12, 20–22 (WRITE gating), 27 |
| **P2**        | Full FM mutations               | 13, 18, 23–25, 28–29           |
| **P3**        | Polish / edge cases             | 26, 30–31, 33                  |

---

## Changelog

| Date                           | Change                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Initial                        | Gap matrix vs legacy `FileManagerModal`                                                                      |
| After attach-parity            | Rows 1–5, 32 → ✅                                                                                            |
| After transfer-actions archive | Rows 14–17 → ✅                                                                                              |
| After delete implementation    | Row 22 → ⚠️ (core ✅, WRITE label gating pending); row 28 slightly improved (`isDeleting` in operation lock) |

---

## References

- Legacy modal: [FileManagerModal.tsx](https://github.com/epam/ai-dial-chat/blob/development/apps/chat/src/components/Files/FileManagerModal.tsx)
- Legacy hook: [useFileManager.tsx](https://github.com/epam/ai-dial-chat/blob/development/apps/chat/src/components/FileManager/hooks/useFileManager.tsx)
- Current modal: `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`
- Current hook: `apps/chat/src/hooks/files/useDialFileManager.ts`
