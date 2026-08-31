import { getUtf8ByteLength } from '@epam/ai-dial-chat-shared';
import {
  SkillFileNodeKind,
  type SkillEditorFileActions,
  type SkillEditorValues,
  type SkillFileTreeNode,
  type SkillFileUploadCandidate,
} from '@epam/ai-dial-skill-editor';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  buildSkillManifest,
  buildSkillManifestFromFrontmatter,
  nameFromPath,
  SKILL_MANIFEST_FILE,
} from './skill';
import {
  validateSkillFileBatch,
  type SkillFileBatchValidationMessages,
} from './skill-file-batch-validation';
import type { SkillFileContent } from './skill-file-preview';

/** Localized messages `useSkillFileActions` needs beyond per-candidate batch validation. */
export interface SkillFileActionsMessages extends SkillFileBatchValidationMessages {
  /** Returned as the commit error when an imported manifest's `name` doesn't match the skill being edited. */
  manifestNameMismatch: string;
  /** Returned as the commit error when the user declines the manifest-import confirmation. */
  manifestImportDeclined: string;
  /** Generic fallback commit error for a batch with invalid candidates but no specific batch error. */
  saveError: string;
}

/** Parameters accepted by {@link useSkillFileActions}. */
export interface UseSkillFileActionsParams {
  /** The editor's current supporting-file tree. */
  files: SkillFileTreeNode[];
  /** Updates `files`. */
  setFiles: Dispatch<SetStateAction<SkillFileTreeNode[]>>;
  /** In-memory bytes for every supporting file, keyed by relative path. */
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
  /** The loaded (or imported) manifest's full parsed frontmatter. */
  frontmatterRef: React.MutableRefObject<Record<string, unknown>>;
  /** The seeded baseline manifest values, used to approximate the projected total size. */
  loadedValues: SkillEditorValues | undefined;
  /** Updates `loadedValues` after a manifest import. */
  setLoadedValues: Dispatch<SetStateAction<SkillEditorValues | undefined>>;
  /** Whether the form is editing an existing skill rather than creating a new one. */
  isEditMode: boolean;
  /** Whether the form currently diverges from its seeded baseline. */
  isDirty: boolean;
  /** Updates the currently selected file-tree node path. */
  setSelectedPath: Dispatch<SetStateAction<string>>;
  /** Localized messages, resolved by the host. */
  messages: SkillFileActionsMessages;
}

/** Return value of {@link useSkillFileActions}. */
export interface UseSkillFileActionsResult {
  /** File-tree mutation operations, passed straight to `SkillEditor`'s `fileActions` prop. */
  fileActions: SkillEditorFileActions;
  /** Whether the "replace Skill metadata?" confirmation prompt should be shown. */
  pendingManifestImport: boolean;
  /** Resolves the in-flight manifest-import confirmation with the user's choice. */
  resolveManifestImport: (accepted: boolean) => void;
}

/**
 * Owns the Skill Editor's batch file upload workflow: validating a staged
 * batch, committing it atomically (supporting files plus an optional
 * `SKILL.md` manifest import, with a confirmation gate), and removing
 * already-committed nodes.
 */
export const useSkillFileActions = ({
  files,
  setFiles,
  filesContentRef,
  frontmatterRef,
  loadedValues,
  setLoadedValues,
  isEditMode,
  isDirty,
  setSelectedPath,
  messages,
}: UseSkillFileActionsParams): UseSkillFileActionsResult => {
  const [pendingManifestImport, setPendingManifestImport] = useState(false);
  const manifestImportResolveRef = useRef<((accepted: boolean) => void) | null>(
    null,
  );

  /*
   * The live in-progress name/description/instructions the user is typing
   * live only inside `libs/skill-editor`'s internal form state — this hook
   * only ever sees them via the host's `onSubmit`. `loadedValues` (the seeded
   * baseline) is therefore the closest available approximation of "the
   * current manifest" for the projected-total-size check; the BFF remains
   * the authoritative gate regardless of this estimate's precision.
   */
  const buildBatchValidationContext = useCallback(() => {
    const existingPaths = files
      .filter((node) => node.kind === SkillFileNodeKind.File)
      .map((node) => node.path);
    let existingTotalBytes = 0;
    for (const path of existingPaths) {
      existingTotalBytes +=
        filesContentRef.current.get(path)?.bytes.length ?? 0;
    }
    const baseline = {
      name: loadedValues?.name ?? '',
      description: loadedValues?.description ?? '',
      instructions: loadedValues?.instructions ?? '',
    };
    const manifestText = isEditMode
      ? buildSkillManifestFromFrontmatter(
          frontmatterRef.current,
          baseline.name,
          baseline.description,
          baseline.instructions,
        )
      : buildSkillManifest(baseline);
    return {
      existingPaths,
      existingTotalBytes,
      manifestByteLength: getUtf8ByteLength(manifestText),
      messages,
    };
  }, [
    files,
    filesContentRef,
    isEditMode,
    frontmatterRef,
    loadedValues,
    messages,
  ]);

  const confirmManifestImport = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      manifestImportResolveRef.current = resolve;
      setPendingManifestImport(true);
    });
  }, []);

  const resolveManifestImport = useCallback((accepted: boolean) => {
    setPendingManifestImport(false);
    manifestImportResolveRef.current?.(accepted);
    manifestImportResolveRef.current = null;
  }, []);

  const fileActions = useMemo<SkillEditorFileActions>(
    () => ({
      validateBatch: async (candidates: SkillFileUploadCandidate[]) => {
        const { results, batchErrors } = await validateSkillFileBatch(
          candidates,
          buildBatchValidationContext(),
        );
        return { results, batchErrors };
      },
      commitBatch: async (candidates: SkillFileUploadCandidate[]) => {
        const { results, batchErrors, manifestCandidate } =
          await validateSkillFileBatch(
            candidates,
            buildBatchValidationContext(),
          );
        const hasInvalid = results.some((result) => result.error !== undefined);
        if (hasInvalid || batchErrors.length > 0) {
          return {
            error: batchErrors[0]?.message ?? messages.saveError,
          };
        }

        if (manifestCandidate) {
          if (
            isEditMode &&
            manifestCandidate.name !== (loadedValues?.name ?? '')
          ) {
            return { error: messages.manifestNameMismatch };
          }
          if (isEditMode || isDirty) {
            const accepted = await confirmManifestImport();
            if (!accepted) {
              return { error: messages.manifestImportDeclined };
            }
          }
        }

        try {
          const supportingCandidates = candidates.filter(
            (candidate) => candidate.id !== manifestCandidate?.candidateId,
          );
          const reads = await Promise.all(
            supportingCandidates.map(async (candidate) => ({
              path: candidate.path,
              bytes: new Uint8Array(await candidate.file.arrayBuffer()),
              mimeType: candidate.file.type || undefined,
            })),
          );

          for (const read of reads) {
            filesContentRef.current.set(read.path, {
              bytes: read.bytes,
              mimeType: read.mimeType,
            });
          }
          if (reads.length > 0) {
            setFiles((prev) => [
              ...prev,
              ...reads.map((read) => ({
                path: read.path,
                name: nameFromPath(read.path),
                kind: SkillFileNodeKind.File,
              })),
            ]);
          }

          if (manifestCandidate) {
            frontmatterRef.current = isEditMode
              ? { ...frontmatterRef.current, ...manifestCandidate.frontmatter }
              : manifestCandidate.frontmatter;
            setLoadedValues({
              name: isEditMode
                ? (loadedValues?.name ?? manifestCandidate.name)
                : manifestCandidate.name,
              description: manifestCandidate.description,
              instructions: manifestCandidate.instructions,
            });
          }

          return {};
        } catch (err) {
          return { error: err instanceof Error ? err.message : String(err) };
        }
      },
      onRemoveNode: (path) => {
        setFiles((prev) =>
          prev.filter(
            (node) => node.path !== path && !node.path.startsWith(`${path}/`),
          ),
        );
        for (const key of [...filesContentRef.current.keys()]) {
          if (key === path || key.startsWith(`${path}/`)) {
            filesContentRef.current.delete(key);
          }
        }
        setSelectedPath((prev) =>
          prev === path || prev.startsWith(`${path}/`)
            ? SKILL_MANIFEST_FILE
            : prev,
        );
      },
    }),
    [
      buildBatchValidationContext,
      isEditMode,
      isDirty,
      loadedValues,
      confirmManifestImport,
      filesContentRef,
      frontmatterRef,
      setFiles,
      setLoadedValues,
      setSelectedPath,
      messages,
    ],
  );

  return { fileActions, pendingManifestImport, resolveManifestImport };
};
