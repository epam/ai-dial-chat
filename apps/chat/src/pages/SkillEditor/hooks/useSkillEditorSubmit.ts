import {
  SkillFileNodeKind,
  type SkillEditorErrors,
  type SkillEditorValues,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { SkillEditorI18nKeys } from '../../../constants/translation-keys';
import { useNotification } from '../../../context/NotificationContext';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '../../../server-api/api-error';
import { createSkill, updateSkill } from '../../../server-api/skills.api';
import {
  buildSkillManifest,
  buildSkillManifestFromFrontmatter,
  isValidSkillRelativePath,
  normalizeSkillName,
} from '../../../utils/skill';
import type { SkillFileContent } from '../../../utils/skill-file-preview';
import { toBlob } from '../utils/skill-file-tree';

/*
 * Phase names collapse the tasks.md-specified `initial`/`dirty` distinction
 * into a single `idle` phase for submit purposes — dirty tracking for
 * navigation guards is handled separately (via the library's
 * `onDirtyChange`), not folded into this enum.
 */
type SubmitPhase = 'idle' | 'submitting' | 'success' | 'failure';

/*
 * Fingerprints the in-memory package (form values + supporting-file paths) so
 * a retried submission after a 503 resubmits the exact same request payload
 * rather than re-deriving it from (possibly since-edited) current form state.
 */
const fingerprintAttempt = (
  values: SkillEditorValues,
  files: SkillFileTreeNode[],
): string =>
  JSON.stringify({
    values,
    files: [...files].sort((a, b) => a.path.localeCompare(b.path)),
  });

interface LastAttempt {
  fingerprint: string;
  bucket: string;
  path: string;
  skillManifest: string;
  filePaths: string[];
  files: Blob[];
}

interface UseSkillEditorSubmitParams {
  bucket: string | undefined;
  isEditMode: boolean;
  files: SkillFileTreeNode[];
  filesContentRef: React.MutableRefObject<Map<string, SkillFileContent>>;
  frontmatterRef: React.MutableRefObject<Record<string, unknown>>;
  loadedPathRef: React.MutableRefObject<string | undefined>;
  etagRef: React.MutableRefObject<string | undefined>;
  returnUrl: string;
  refetchSkills: () => Promise<void>;
}

interface UseSkillEditorSubmitResult {
  phase: SubmitPhase;
  errors: SkillEditorErrors;
  submitError: string | undefined;
  conflict: { message: string } | undefined;
  clearConflict: () => void;
  handleSubmit: (values: SkillEditorValues) => Promise<void>;
}

/**
 * Owns the Skill Editor's create/edit submission flow: field validation,
 * building and (in edit mode) merging the `SKILL.md` manifest, calling
 * `createSkill`/`updateSkill`, and mapping the resulting success/error/
 * conflict outcomes to presentable state.
 */
export const useSkillEditorSubmit = ({
  bucket,
  isEditMode,
  files,
  filesContentRef,
  frontmatterRef,
  loadedPathRef,
  etagRef,
  returnUrl,
  refetchSkills,
}: UseSkillEditorSubmitParams): UseSkillEditorSubmitResult => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [errors, setErrors] = useState<SkillEditorErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [conflict, setConflict] = useState<{ message: string } | undefined>();
  const [phase, setPhase] = useState<SubmitPhase>('idle');
  const lastAttemptRef = useRef<LastAttempt | null>(null);

  const applyUploadErrorStatus = useCallback(
    async (err: unknown) => {
      const status = getApiErrorStatus(err);
      switch (status) {
        case 409:
          setErrors({ name: t(SkillEditorI18nKeys.ErrorNameConflict) });
          return;
        case 412:
          /*
           * In edit mode this is a genuine stale-edit conflict, handled
           * separately by `handleSubmit` before this function is ever
           * called. In create mode it is unreachable (create never sends
           * `If-Match`) — treated defensively the same as `409` should it
           * ever occur, which would indicate an unexpected upstream change.
           */
          setErrors({ name: t(SkillEditorI18nKeys.ErrorNameConflict) });
          return;
        case 413:
          setSubmitError(t(SkillEditorI18nKeys.ErrorArchiveTooLarge));
          return;
        case 503:
          setSubmitError(t(SkillEditorI18nKeys.ErrorServiceUnavailable));
          return;
        case 400: {
          /*
           * A 400 has no single fixed cause (bad archive, rejected manifest
           * field, upstream request-shape issue, ...) — show the BFF's own
           * message (which now forwards DIAL Core's `upstreamMessage`)
           * instead of a fixed, potentially misleading guess.
           */
          const { message } = await getApiErrorDetails(err);
          setSubmitError(message ?? t(SkillEditorI18nKeys.ErrorPathInvalid));
          return;
        }
        default: {
          const { traceId } = await getApiErrorDetails(err);
          setSubmitError(t(SkillEditorI18nKeys.ErrorSave));
          showNotification({
            variant: NotificationVariant.Error,
            message: t(SkillEditorI18nKeys.ErrorSave),
            requestId: traceId,
          });
        }
      }
    },
    [showNotification, t],
  );

  const handleSubmitCreate = useCallback(
    async (values: SkillEditorValues) => {
      const normalizedName = normalizeSkillName(values.name);
      if (!normalizedName || !isValidSkillRelativePath(normalizedName)) {
        setErrors({ name: t(SkillEditorI18nKeys.ErrorNameInvalid) });
        return;
      }

      const fingerprint = fingerprintAttempt(values, files);
      const cached = lastAttemptRef.current;
      const canReuse = cached != null && cached.fingerprint === fingerprint;

      const path = normalizedName;
      let skillManifest: string;
      let filePaths: string[];
      let fileBlobs: Blob[];
      if (canReuse) {
        ({ skillManifest, filePaths, files: fileBlobs } = cached);
      } else {
        /*
         * A dropped SKILL.md's unknown frontmatter fields (e.g. `version`)
         * are preserved by merging into the imported frontmatter object
         * rather than always building a fresh one — `frontmatterRef` stays
         * `{}` unless a manifest was imported in this create session.
         */
        skillManifest =
          Object.keys(frontmatterRef.current).length > 0
            ? buildSkillManifestFromFrontmatter(
                frontmatterRef.current,
                normalizedName,
                values.description,
                values.instructions,
              )
            : buildSkillManifest({
                name: normalizedName,
                description: values.description,
                instructions: values.instructions,
              });
        const fileNodes = files.filter(
          (node) => node.kind === SkillFileNodeKind.File,
        );
        filePaths = fileNodes.map((node) => node.path);
        fileBlobs = fileNodes.map((node) =>
          toBlob(
            filesContentRef.current.get(node.path)?.bytes ?? new Uint8Array(0),
          ),
        );
      }

      setPhase('submitting');
      lastAttemptRef.current = {
        fingerprint,
        bucket: bucket as string,
        path,
        skillManifest,
        filePaths,
        files: fileBlobs,
      };

      try {
        await createSkill(
          bucket as string,
          path,
          skillManifest,
          filePaths,
          fileBlobs,
        );
        await refetchSkills();

        setPhase('success');
        showNotification({
          variant: NotificationVariant.Success,
          title: t(SkillEditorI18nKeys.SaveSuccessTitle),
          message: t(SkillEditorI18nKeys.CreateSuccess, {
            name: normalizedName,
          }),
        });
        navigate(returnUrl);
      } catch (err) {
        setPhase('failure');
        await applyUploadErrorStatus(err);
      }
    },
    [
      bucket,
      files,
      filesContentRef,
      frontmatterRef,
      t,
      showNotification,
      navigate,
      returnUrl,
      refetchSkills,
      applyUploadErrorStatus,
    ],
  );

  const handleSubmitEdit = useCallback(
    async (values: SkillEditorValues) => {
      const path = loadedPathRef.current;
      const etag = etagRef.current;
      if (!path || !etag) {
        setSubmitError(t(SkillEditorI18nKeys.ErrorSave));
        return;
      }

      const skillManifest = buildSkillManifestFromFrontmatter(
        frontmatterRef.current,
        values.name,
        values.description,
        values.instructions,
      );
      const fileNodes = files.filter(
        (node) => node.kind === SkillFileNodeKind.File,
      );
      const filePaths = fileNodes.map((node) => node.path);
      const fileBlobs = fileNodes.map((node) =>
        toBlob(
          filesContentRef.current.get(node.path)?.bytes ?? new Uint8Array(0),
        ),
      );

      setPhase('submitting');
      try {
        const result = await updateSkill(
          bucket as string,
          path,
          skillManifest,
          filePaths,
          fileBlobs,
          etag,
        );
        etagRef.current = result.etag ?? etag;
        await refetchSkills();

        setPhase('success');
        showNotification({
          variant: NotificationVariant.Success,
          title: t(SkillEditorI18nKeys.SaveSuccessTitle),
          message: t(SkillEditorI18nKeys.UpdateSuccess, {
            name: values.name,
          }),
        });
        navigate(returnUrl);
      } catch (err) {
        setPhase('failure');
        const status = getApiErrorStatus(err);
        if (status === 412) {
          setConflict({ message: t(SkillEditorI18nKeys.ConflictMessage) });
          return;
        }
        await applyUploadErrorStatus(err);
      }
    },
    [
      bucket,
      files,
      filesContentRef,
      frontmatterRef,
      loadedPathRef,
      etagRef,
      t,
      showNotification,
      navigate,
      returnUrl,
      refetchSkills,
      applyUploadErrorStatus,
    ],
  );

  const handleSubmit = useCallback(
    async (values: SkillEditorValues) => {
      if (phase === 'submitting' || !bucket) return;

      const nextErrors: SkillEditorErrors = {};
      if (!values.name.trim())
        nextErrors.name = t(SkillEditorI18nKeys.ErrorRequired);
      if (!values.description.trim()) {
        nextErrors.description = t(SkillEditorI18nKeys.ErrorRequired);
      }
      if (!values.instructions.trim()) {
        nextErrors.instructions = t(SkillEditorI18nKeys.ErrorRequired);
      }
      if (Object.keys(nextErrors).length > 0) {
        setErrors(nextErrors);
        return;
      }

      setErrors({});
      setSubmitError(undefined);
      setConflict(undefined);

      if (isEditMode) {
        await handleSubmitEdit(values);
      } else {
        await handleSubmitCreate(values);
      }
    },
    [phase, bucket, t, isEditMode, handleSubmitEdit, handleSubmitCreate],
  );

  return {
    phase,
    errors,
    submitError,
    conflict,
    clearConflict: () => setConflict(undefined),
    handleSubmit,
  };
};
