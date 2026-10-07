# Reusable chat workflows

Three stateful chat workflows ship as public package APIs so that every
DIAL-Core-backed chat application can run the same state machine instead of
keeping its own copy:

| Workflow         | Public import                                                                                                                | Owning package              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Skill import     | `useSkillArchiveImport` from `@epam/ai-dial-chat-hooks/skill-editor`; `SkillArchiveUploadDialog` from `@epam/ai-dial-skills` | `chat-hooks`, `skills`      |
| File attachment  | `useFileAttachmentPicker` from `@epam/ai-dial-chat-hooks/file-manager`, composed with the existing `FileManagerAttachModal`  | `chat-hooks`, `chat-shared` |
| Prompt selection | `usePromptSelectorOverlay` from `@epam/ai-dial-prompts`                                                                      | `prompts`                   |

Both `chat-hooks` hooks are also exported from the package root. No other
package forwards these names.

This guide covers two hosts:

- **The parent** — `apps/chat` in this repository. It already runs all three
  workflows through the public APIs (see [Parent adoption](#parent-adoption-appschat)).
- **The client application** — a second chat host maintained in its own
  repository, which is not checked out here. It has **not** been migrated.
  The change that extracted these workflows
  ([`extract-reusable-chat-workflows`](../openspec/changes/archive/2026-09-21-extract-reusable-chat-workflows/design.md))
  deliberately made no client application edits and published no packages.
  The [adoption map](#client-application-adoption-map) below is the plan for
  that follow-up migration, not a record of it.

A passing packed-artifact fixture proves that the packages install, resolve,
typecheck and bundle outside this monorepo. It does not show that the client
application has migrated, and it does not run the client application's tests.

## Parent adoption (`apps/chat`)

What `apps/chat` does today, read from source:

| Parent file                                                                      | Calls                                                                                       | Still owned by the app                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/chat/src/hooks/skills/useSkillArchiveImport.ts`                            | `useSkillArchiveImport` (root of `@epam/ai-dial-chat-hooks`)                                | The `importSkillArchive` request from `server-api/skills.api.ts`, the "Skill created" notification (`useOperationNotification`), the awaited `refetchSkills()` (`SkillsContext`), mapping each `SkillArchiveImportErrorKind` to a `SkillArchiveImportI18nKeys` message, and a trace-id error toast for `Generic` failures only                        |
| `apps/chat/src/components/SkillArchiveUploadDialog/SkillArchiveUploadDialog.tsx` | `SkillArchiveUploadDialog` from `@epam/ai-dial-skills`                                      | Translated labels and the `SKILL_ARCHIVE_ACCEPT` hint                                                                                                                                                                                                                                                                                                 |
| `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`         | `useFileAttachmentPicker` (root of `@epam/ai-dial-chat-hooks`) and `FileManagerAttachModal` | `useDialFileManagerHostOptions`, `fileManagerTabs` from `AppConfigContext`, tab labels, `initialTab: DialFileManagerTabs.All`, `NOT_ALLOWED_SYMBOLS_REGEXP`, `resolveFolderPath`, the constraint description sentence and tooltips, the hidden-file disabled tooltip, unsupported-file and too-many-files notifications, and the full modal label set |
| `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx`           | `usePromptSelectorOverlay` from `@epam/ai-dial-prompts`                                     | `useUiFeature(OverlayFeature.Prompts)` as `isEnabled`, the merged prompt list from `PromptsContext`, favorites from `FavoriteApplicationsContext`, translated labels, and the lazy `PromptCatalogModal` passed as `renderCatalog`                                                                                                                     |
| `apps/chat/src/components/PromptSelector/PromptCatalogModal.tsx`                 | —                                                                                           | Host catalog rendering, loaded through `React.lazy`                                                                                                                                                                                                                                                                                                   |

The parent's former `PromptSelectorOverlay.tsx` and
`PromptParametersPopupOverlay.tsx` no longer exist; their rendering now lives
in `@epam/ai-dial-prompts`. None of the adapters above keeps its own dialog
status, selection set, tab state or pending-prompt state.

## Client application adoption map

The client application paths below are relative to the client application's
own repository. They come from the 2026-09-21 audit recorded in the archived
[design](../openspec/changes/archive/2026-09-21-extract-reusable-chat-workflows/design.md).
This repository cannot re-check them, so confirm each one against current
client application source before you start.

Audit observations: the client application's skill hook and dialog bodies
matched the parent's pre-extraction copies. Its prompt orchestration differed
in host gating (no `OverlayFeature.Prompts` check) and in catalog callbacks.
Its file picker still filtered hidden paths in an app callback, which the
shared modal and `useFileAttachmentPicker` now do. The audit baseline was the
client application's installed `1.2.0-dev.58` packages, which contain none of
these exports.

| Client application file (audit)                                                  | Replace with                                                                                                                                                                 | Workflow logic that can be deleted                                                                                                                                                                                                                  | Host keeps                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/chat/src/hooks/skills/useSkillArchiveImport.ts`                            | `useSkillArchiveImport` and `SkillArchiveImportStatus` / `SkillArchiveImportErrorKind` / `SkillArchiveSelectionRejectionReason` from `@epam/ai-dial-chat-hooks/skill-editor` | Dialog open state, the exact-`SKILL.md` filename precheck, in-flight exclusion, `AbortSignal` cancellation on close, late-completion guard after unmount, and the HTTP status → error-kind classification (400/413/422, 409, 429, 502/503, generic) | The configured import request (`importArchive(file, signal)`), the success notification and awaited list refresh in `onImported`, error-kind → translated message mapping, trace-id resolution for generic failures, and the catalog's "Upload" entry point                                                 |
| `apps/chat/src/components/SkillArchiveUploadDialog/SkillArchiveUploadDialog.tsx` | `SkillArchiveUploadDialog` from `@epam/ai-dial-skills`, plus `import '@epam/ai-dial-skills/styles.css'`                                                                      | Dialog markup, drop zone, native picker, keyboard close/focus handling, inline error and uploading spinner                                                                                                                                          | `labels` (`SkillArchiveUploadDialogLabels`), the `accept` hint, and the `errorText` string the host translates                                                                                                                                                                                              |
| `apps/chat/src/components/DialFileManagerModal/DialFileManagerModal.tsx`         | `useFileAttachmentPicker` from `@epam/ai-dial-chat-hooks/file-manager`, forwarded into `FileManagerAttachModal` from `@epam/ai-dial-chat-shared/file-manager`                | Active tab, selected paths (defensively copied, cleared on tab change), allowed-tab filtering, and hidden-path / MIME / size / folder row eligibility — including the app-side hidden-path filter the audit found                                   | Configured file-manager options (`fileManagerOptions`, `bucket`), tab labels, allowed tabs and initial tab, attachment constraints, `resolveFolderPath`, notifications for skipped and over-limit files, constraint descriptions and tooltips, all modal labels, and handing `AttachResult` to the composer |
| `apps/chat/src/components/PromptSelector/usePromptSelectorOverlay.tsx`           | `usePromptSelectorOverlay` from `@epam/ai-dial-prompts`, plus `import '@epam/ai-dial-prompts/styles.css'`                                                                    | Pending prompt, browse visibility, selection origin (browse vs. direct/favorites), parameter extraction and resolution, Back/cancel/submit transitions, and disabled-mode handling                                                                  | `isEnabled` (the client application can pass `true`), structural `prompts` mapped from its API responses, `favoriteIds` and `onToggleFavorite`, `onInsertText`, labels, and `renderCatalog`                                                                                                                 |
| `apps/chat/src/components/PromptSelector/PromptSelectorOverlay.tsx`              | Nothing — `renderOverlay` from the hook result                                                                                                                               | The favorites overlay wrapper                                                                                                                                                                                                                       | Placing `renderOverlay` in its Add menu                                                                                                                                                                                                                                                                     |
| `apps/chat/src/components/PromptSelector/PromptParametersPopupOverlay.tsx`       | Nothing — `parametersPopup` from the hook result                                                                                                                             | The parameters popup wrapper and its open/back/submit state                                                                                                                                                                                         | Rendering `parametersPopup` and `promptCatalogModal` outside the transient Add-menu popover; calling `openParametersPopup` from a route-level "use prompt" action                                                                                                                                           |
| `apps/chat/src/components/PromptSelector/PromptCatalogModal.tsx`                 | Kept                                                                                                                                                                         | —                                                                                                                                                                                                                                                   | The whole catalog, returned from `renderCatalog({ isOpen, onSelect, onClose })` and ideally kept behind `React.lazy`                                                                                                                                                                                        |

Styles: `@epam/ai-dial-skills/styles.css` and `@epam/ai-dial-prompts/styles.css`
are each imported once at the host root. `@epam/ai-dial-chat-hooks` is
headless and ships no stylesheet. The file picker renders through
`FileManagerAttachModal`, so it needs the stylesheets the host already imports
for that modal (`@epam/ai-dial-chat-shared/styles.css` and
`@epam/ai-dial-react-file-manager/styles.css`). Nothing here adds a
translation key, feature flag, endpoint or storage key.

### Integration checklist

Skill import:

1. Install the aligned release (see [Release alignment](#release-alignment)).
2. Rewrite the app hook as an adapter over `useSkillArchiveImport<TResult>`:
   pass `importArchive`, `onImported` and `onError(error, kind)`. Keep the
   return shape the catalog view already consumes.
3. Replace the dialog body with `SkillArchiveUploadDialog` and pass translated
   `labels`.
4. Delete the local precheck, status enum and error classifier.
5. Keep the app's own adapter tests and add one for the generic-only trace-id
   toast.

File attachment:

1. Install the aligned release.
2. Call `useFileAttachmentPicker` with the app's existing file-manager options
   and constraints, then forward `controller`, `activeTab`, `tabs`,
   `onTabChange`, `selectedPaths`, `onSelectedPathsChange`, `isRowSelectable`,
   `isFileTypeAllowed` and `allowedFileTypes` to `FileManagerAttachModal`.
3. Delete the local selection/tab state and the app-side hidden-path filter.
   Final filtering, folder/descendant deduplication and the attachment count
   check stay in `FileManagerAttachModal`.
4. Keep `resolveFolderPath` in the app.

Prompt selection:

1. Install the aligned release.
2. Rewrite the app hook as an adapter over `usePromptSelectorOverlay`,
   passing `isEnabled: true` unless the app has its own gate.
3. Pass the existing catalog modal through `renderCatalog`.
4. Delete the overlay and parameters-popup wrappers.
5. Render `parametersPopup` and `promptCatalogModal` at a level that outlives
   the Add-menu popover.

### Minimal host wiring

These snippets typecheck against the current public APIs.

```tsx
import {
  SkillArchiveImportErrorKind,
  useSkillArchiveImport,
} from '@epam/ai-dial-chat-hooks/skill-editor';
import { SkillArchiveUploadDialog } from '@epam/ai-dial-skills';
import '@epam/ai-dial-skills/styles.css';

interface ImportedSkill {
  name: string;
}

interface SkillImportProps {
  importArchive: (file: File, signal: AbortSignal) => Promise<ImportedSkill>;
  onImported: (skill: ImportedSkill) => Promise<void>;
  onUnexpectedError: (error: unknown) => void;
  errorMessages: Record<SkillArchiveImportErrorKind, string>;
  uploadLabel: string;
}

export const SkillImport = ({
  importArchive,
  onImported,
  onUnexpectedError,
  errorMessages,
  uploadLabel,
}: SkillImportProps) => {
  const importer = useSkillArchiveImport<ImportedSkill>({
    importArchive,
    onImported,
    onError: (error, kind) => {
      if (kind === SkillArchiveImportErrorKind.Generic)
        onUnexpectedError(error);
    },
  });

  return (
    <>
      <button type="button" onClick={importer.openDialog}>
        {uploadLabel}
      </button>
      <SkillArchiveUploadDialog
        isOpen={importer.isDialogOpen}
        isUploading={importer.isUploading}
        errorText={
          importer.errorKind ? errorMessages[importer.errorKind] : undefined
        }
        accept=".zip,.md"
        onClose={importer.closeDialog}
        onFilesSelected={importer.handleFilesSelected}
        onFilesRejected={importer.handleFilesRejected}
      />
    </>
  );
};
```

```tsx
import {
  useFileAttachmentPicker,
  type UseFileAttachmentPickerOptions,
} from '@epam/ai-dial-chat-hooks/file-manager';
import {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
  type AttachResult,
  type FileManagerAttachModalLabels,
} from '@epam/ai-dial-chat-shared';
import { FileManagerAttachModal } from '@epam/ai-dial-chat-shared/file-manager';
import type { DialFile } from '@epam/ai-dial-react-file-manager';

interface AttachPickerProps {
  isOpen: boolean;
  pickerOptions: UseFileAttachmentPickerOptions;
  labels: FileManagerAttachModalLabels;
  resolveFolderPath: (file: DialFile) => string | null;
  onClose: () => void;
  onAttach: (result: AttachResult) => void;
}

export const AttachPicker = ({
  isOpen,
  pickerOptions,
  labels,
  resolveFolderPath,
  onClose,
  onAttach,
}: AttachPickerProps) => {
  const picker = useFileAttachmentPicker(pickerOptions);

  return (
    <FileManagerAttachModal
      isOpen={isOpen}
      onClose={onClose}
      onAttach={onAttach}
      controller={picker.controller}
      isAnyOperationInProgress={picker.controller.isAnyOperationInProgress}
      activeTab={picker.activeTab}
      tabs={picker.tabs}
      onTabChange={picker.onTabChange}
      labels={labels}
      variant={DialFileManagerVariant.Attach}
      actionProfile={DialFileManagerActionProfile.Attach}
      selectedPaths={picker.selectedPaths}
      onSelectedPathsChange={picker.onSelectedPathsChange}
      resolveFolderPath={resolveFolderPath}
      isFileTypeAllowed={picker.isFileTypeAllowed}
      isRowSelectable={picker.isRowSelectable}
      allowedFileTypes={picker.allowedFileTypes}
      maxSelectableFileSize={pickerOptions.maxSelectableFileSize}
    />
  );
};
```

```tsx
import {
  usePromptSelectorOverlay,
  type FavoritePromptItem,
  type RenderPromptCatalogProps,
  type UsePromptSelectorOverlayLabels,
  type UsePromptSelectorOverlayResult,
} from '@epam/ai-dial-prompts';
import '@epam/ai-dial-prompts/styles.css';
import type { ReactNode } from 'react';

interface PromptPickerOptions {
  prompts: FavoritePromptItem[];
  favoriteIds: ReadonlySet<string>;
  onToggleFavorite: (id: string) => void;
  onInsertText: (text: string) => void;
  labels: UsePromptSelectorOverlayLabels;
  renderCatalog: (props: RenderPromptCatalogProps) => ReactNode;
}

export const usePromptPicker = (
  options: PromptPickerOptions,
): UsePromptSelectorOverlayResult =>
  usePromptSelectorOverlay({ isEnabled: true, ...options });
```

Full option and result types are documented in
[`libs/chat-hooks/README.md`](../libs/chat-hooks/README.md),
[`libs/skills/README.md`](../libs/skills/README.md) and
[`libs/prompts/README.md`](../libs/prompts/README.md).

## Release alignment

Every library in this repository is versioned `0.0.1` in source. At publish
time, `tools/publish-lib-package-json.mjs` sets one publish version and pins
each workspace-sibling dependency to that same version. The client
application must therefore install **one** release in which all of these
packages come from the same publish:

- `@epam/ai-dial-chat-hooks`
- `@epam/ai-dial-skills`
- `@epam/ai-dial-prompts`
- `@epam/ai-dial-chat-shared`
- the workspace packages they pull in transitively (`@epam/ai-dial-catalog`,
  `@epam/ai-dial-publish-panel`, `@epam/ai-dial-conversation-input`,
  `@epam/ai-dial-attachment-input`, `@epam/ai-dial-chat-api-client`)

No release number is assigned yet; the existing release process assigns it.
Mixing packages from different releases is untested. That release will also
carry unrelated changes, so review its release notes before upgrading. For
the external peers each package needs, see the generated
[host install matrix](host-install-matrix.md).

## Verification

### Tested artifact set

| Package                    | Entries tested                                             | Packed-consumer check                                                                                                                |
| -------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `@epam/ai-dial-chat-hooks` | `./skill-editor`, `./file-manager` (and the root)          | [`libs/chat-hooks/e2e-fixtures`](../libs/chat-hooks/e2e-fixtures/README.md) — the `skill-editor` and `file-manager` subpath fixtures |
| `@epam/ai-dial-skills`     | root, `./styles.css`                                       | [`tools/reusable-workflows-consumer-fixture`](../tools/reusable-workflows-consumer-fixture/README.md)                                |
| `@epam/ai-dial-prompts`    | root, `./styles.css` (`./parameters-popup` reached lazily) | [`tools/reusable-workflows-consumer-fixture`](../tools/reusable-workflows-consumer-fixture/README.md)                                |

`tools/attachment-canvas-consumer-fixture` is not part of this set. It covers
`@epam/ai-dial-attachment-canvas` and served as the starting pattern for the
reusable-workflows fixture.

### Automated checks

| Check                              | Command                                                                                                                                                                                                                                | Proves                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skill-import controller behavior   | `npm run test:file -- libs/chat-hooks/src/skill/useSkillArchiveImport/tests/useSkillArchiveImport.spec.ts`                                                                                                                             | Filename precheck, rejection, in-flight exclusion, retry, error classification, refresh failure without re-import, late completion, abort on close                                                                                                                                                         |
| Upload dialog                      | `npm run test:file -- libs/skills/src/components/SkillArchiveUploadDialog/tests/SkillArchiveUploadDialog.spec.tsx`                                                                                                                     | Labels, keyboard close, file selection, accessible errors, RTL                                                                                                                                                                                                                                             |
| Attachment picker behavior         | `npm run test:file -- libs/chat-hooks/src/files/useFileAttachmentPicker/tests/useFileAttachmentPicker.spec.ts`                                                                                                                         | Defensive selection copies, tab resets, allowed tabs, hidden/MIME/size/folder eligibility                                                                                                                                                                                                                  |
| Prompt workflow behavior           | `npm run test:file -- libs/prompts/src/hooks/usePromptSelectorOverlay/tests/usePromptSelectorOverlay.spec.tsx`                                                                                                                         | Immediate insertion, browse/direct parameters, Back, cancel, submit-once, popover-unmount survival, disabled mode, injected catalog, keyboard/RTL                                                                                                                                                          |
| Export contract                    | `npm run test:file -- libs/chat-hooks/src/entry-points/tests/reusable-workflow-exports.spec.ts`                                                                                                                                        | Both hooks are exported from the root and their subpath entry, the prompt workflow pulls in no eager file-manager/editor/canvas dependency, and no package forwards another's workflow export                                                                                                              |
| Parent adapters                    | `apps/chat/src/hooks/skills/tests/useSkillArchiveImport.spec.ts`, `apps/chat/src/components/SkillArchiveUploadDialog/tests/`, `apps/chat/src/components/DialFileManagerModal/tests/`, `apps/chat/src/components/PromptSelector/tests/` | `apps/chat`'s host wiring over the public APIs                                                                                                                                                                                                                                                             |
| `chat-hooks` packed consumer       | `npm exec nx run @epam/ai-dial-chat-hooks:test-packed --only=skill-editor,file-manager` (or `test-packed-smoke`)                                                                                                                       | The two subpaths install from packed tarballs with their declared peers, then typecheck and bundle                                                                                                                                                                                                         |
| `skills`/`prompts` packed consumer | `npm exec nx run reusable-workflows-consumer-fixture:verify` (also part of `npm test`)                                                                                                                                                 | Both packages install outside the checkout with their full dependency and peer closure (no `--legacy-peer-deps`); their full public surface passes `tsc --noEmit` and a Vite build; both `./styles.css` files reach the bundle; AG Grid is absent from the main chunk and present in a separate lazy chunk |

### What is intentionally not covered

Behavior and package consumption are proven separately, and the gap between
them is deliberate:

- **No fixture mounts or drives a component tree against an installed
  tarball.** The packed-consumer fixtures only typecheck and bundle. Clicks,
  uploads and prompt insertion are exercised only by the library Vitest
  suites, which resolve workspace source rather than packed artifacts.
- **No fixture installs a test runner into an isolated consumer.** Neither
  fixture installs Vitest, jsdom or Testing Library outside the monorepo.
- **The fixtures are not the client application.** A passing fixture shows
  that a host shaped like the client application can install and build these
  packages. It does not show that the client application has migrated or that
  its own test suite passes against the aligned release. Both remain
  follow-up work in the client application's repository.
