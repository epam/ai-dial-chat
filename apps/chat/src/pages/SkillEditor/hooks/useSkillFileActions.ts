import {
  SkillFileNodeKind,
  type SkillEditorFileActions,
  type SkillEditorValues,
  type SkillFileTreeNode,
  type SkillFileUploadCandidate,
} from '@epam/ai-dial-skill-editor';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SkillEditorI18nKeys } from '../../../constants/translation-keys';
import {
  buildSkillManifest,
  buildSkillManifestFromFrontmatter,
  SKILL_MANIFEST_FILE,
} from '../../../utils/skill';
import type { SkillFileContent } from '../../../utils/skill-file-preview';
import { getUtf8ByteLength } from '../../../utils/string-utils';
import type { SkillFileBatchValidationMessages } from '../models/skill-file-batch-validation';
import { validateSkillFileBatch } from '../utils/skill-file-batch-validation';
import { nameFromPath } from '../utils/skill-file-tree';

interface UseSkillFileActionsParams {
  files: SkillFileTreeNode[];
  setFiles: Dispatch<SetStateAction<SkillFileTreeNode[]>>;
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
  frontmatterRef: React.MutableRefObject<Record<string, unknown>>;
  loadedValues: SkillEditorValues | undefined;
  setLoadedValues: Dispatch<SetStateAction<SkillEditorValues | undefined>>;
  isEditMode: boolean;
  isDirty: boolean;
  setSelectedPath: Dispatch<SetStateAction<string>>;
}

interface UseSkillFileActionsResult {
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
}: UseSkillFileActionsParams): UseSkillFileActionsResult => {
  const { t } = useTranslation();
  const [pendingManifestImport, setPendingManifestImport] = useState(false);
  const manifestImportResolveRef = useRef<((accepted: boolean) => void) | null>(
    null,
  );

  const batchValidationMessages = useMemo<SkillFileBatchValidationMessages>(
    () => ({
      required: t(SkillEditorI18nKeys.ErrorRequired),
      pathReserved: t(SkillEditorI18nKeys.ErrorPathReserved),
      pathInvalid: t(SkillEditorI18nKeys.ErrorPathInvalid),
      pathDuplicate: t(SkillEditorI18nKeys.ErrorPathDuplicate),
      fileTooLarge: (maxSize) =>
        t(SkillEditorI18nKeys.ErrorFileTooLarge, { maxSize }),
      manifestCasingInvalid: t(SkillEditorI18nKeys.ErrorManifestCasingInvalid),
      manifestDuplicate: t(SkillEditorI18nKeys.ErrorManifestDuplicate),
      manifestInvalidUtf8: t(SkillEditorI18nKeys.ErrorManifestInvalidUtf8),
      manifestInvalidFrontmatter: t(
        SkillEditorI18nKeys.ErrorManifestInvalidFrontmatter,
      ),
      totalSizeExceeded: t(SkillEditorI18nKeys.ErrorTotalSizeExceeded),
      totalCountExceeded: t(SkillEditorI18nKeys.ErrorTotalCountExceeded),
    }),
    [t],
  );

  /*
   * The live in-progress name/description/instructions the user is typing
   * live only inside `libs/skill-editor`'s internal form state — this page
   * only ever sees them via `onSubmit`. `loadedValues` (the seeded baseline)
   * is therefore the closest available approximation of "the current
   * manifest" for the projected-total-size check; the BFF remains the
   * authoritative gate regardless of this estimate's precision.
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
      messages: batchValidationMessages,
    };
  }, [
    files,
    filesContentRef,
    isEditMode,
    frontmatterRef,
    loadedValues,
    batchValidationMessages,
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
            error: batchErrors[0]?.message ?? t(SkillEditorI18nKeys.ErrorSave),
          };
        }

        if (manifestCandidate) {
          if (
            isEditMode &&
            manifestCandidate.name !== (loadedValues?.name ?? '')
          ) {
            return { error: t(SkillEditorI18nKeys.ErrorManifestNameMismatch) };
          }
          if (isEditMode || isDirty) {
            const accepted = await confirmManifestImport();
            if (!accepted) {
              return {
                error: t(SkillEditorI18nKeys.ErrorManifestImportDeclined),
              };
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
      t,
    ],
  );

  return { fileActions, pendingManifestImport, resolveManifestImport };
};
