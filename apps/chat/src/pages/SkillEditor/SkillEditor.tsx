import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  SkillEditor as SkillEditorForm,
  SkillFileNodeKind,
  type SkillEditorErrors,
  type SkillEditorFileActions,
  type SkillEditorLabels,
  type SkillEditorValues,
  type SkillFileTreeNode,
} from '@epam/ai-dial-skill-editor';
import {
  ErrorText,
  GhostIconButton,
  NotificationVariant,
  PrimaryButton,
} from '@epam/ai-dial-ui-kit';
import { IconArrowLeft } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { isSafeReturnUrl } from '../../constants/routes';
import {
  ButtonsI18nKeys,
  SkillEditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useNotification } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '../../server-api/api-error';
import { listSkills, uploadSkill } from '../../server-api/skills.api';
import { ROUTES } from '../../types/routes';
import { SkillEditorQuery } from '../../types/skill-editor';
import { ThemeId } from '../../types/theme-id';
import {
  buildSkillArchive,
  buildSkillManifest,
  isValidSkillRelativePath,
  normalizeSkillName,
} from '../../utils/skill';

/*
 * Phase names collapse the tasks.md-specified `initial`/`dirty` distinction
 * into a single `idle` phase: the presentational `SkillEditor` form owns
 * every keystroke internally and only calls back into this page on submit,
 * so the page has no signal to distinguish "untouched" from "edited but not
 * yet submitted" — both render identically here (Cancel always navigates
 * immediately, no API call). See tasks.md section 12 for this documented
 * deviation.
 */
type SubmitPhase = 'idle' | 'submitting' | 'success' | 'failure';

const nameFromPath = (path: string): string => {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash === -1 ? path : path.slice(lastSlash + 1);
};

/*
 * Fingerprints the in-memory package (form values + supporting-file paths) so
 * a retried submission after a 503 can detect "nothing changed" and reuse the
 * already-built archive instead of rebuilding it (tasks.md 11.2/11.3).
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
  archive: Blob;
}

const SkillEditorPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useUser();
  const { currentTheme } = useTheme();
  const { showNotification } = useNotification();

  const rawReturnUrl = searchParams.get(SkillEditorQuery.ReturnUrl);
  const returnUrl =
    rawReturnUrl != null && isSafeReturnUrl(rawReturnUrl)
      ? rawReturnUrl
      : ROUTES.Catalog;

  const bucket = user?.bucket;

  const [files, setFiles] = useState<SkillFileTreeNode[]>([]);
  const filesContentRef = useRef<Map<string, Uint8Array>>(new Map());
  const lastAttemptRef = useRef<LastAttempt | null>(null);

  const [errors, setErrors] = useState<SkillEditorErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>();
  const [phase, setPhase] = useState<SubmitPhase>('idle');

  const handleCancel = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const validatePath = useCallback(
    (path: string): string | undefined => {
      if (!path) return t(SkillEditorI18nKeys.ErrorRequired);
      if (path === 'SKILL.md') {
        return t(SkillEditorI18nKeys.ErrorPathReserved);
      }
      if (!isValidSkillRelativePath(path)) {
        return t(SkillEditorI18nKeys.ErrorPathInvalid);
      }
      if (files.some((node) => node.path === path)) {
        return t(SkillEditorI18nKeys.ErrorPathDuplicate);
      }
      return undefined;
    },
    [files, t],
  );

  const fileActions = useMemo<SkillEditorFileActions>(
    () => ({
      validatePath,
      onAddNode: (path, kind) => {
        if (kind === SkillFileNodeKind.File) {
          filesContentRef.current.set(path, new Uint8Array(0));
        }
        setFiles((prev) => [...prev, { path, name: nameFromPath(path), kind }]);
      },
      onUploadFile: async (file, path) => {
        const buffer = await file.arrayBuffer();
        filesContentRef.current.set(path, new Uint8Array(buffer));
        setFiles((prev) => [
          ...prev,
          { path, name: nameFromPath(path), kind: SkillFileNodeKind.File },
        ]);
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
      },
    }),
    [validatePath],
  );

  const applyUploadErrorStatus = useCallback(
    async (err: unknown) => {
      const status = getApiErrorStatus(err);
      switch (status) {
        case 409:
        case 412:
          setErrors({ name: t(SkillEditorI18nKeys.ErrorNameConflict) });
          return;
        case 413:
          setSubmitError(t(SkillEditorI18nKeys.ErrorArchiveTooLarge));
          return;
        case 422:
          setSubmitError(t(SkillEditorI18nKeys.ErrorTooManyFiles));
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

      const normalizedName = normalizeSkillName(values.name);
      if (!normalizedName || !isValidSkillRelativePath(normalizedName)) {
        setErrors({ name: t(SkillEditorI18nKeys.ErrorNameInvalid) });
        return;
      }

      setErrors({});
      setSubmitError(undefined);

      const fingerprint = fingerprintAttempt(values, files);
      const cached = lastAttemptRef.current;
      const canReuse = cached != null && cached.fingerprint === fingerprint;

      let archive: Blob;
      const path = normalizedName;
      if (canReuse) {
        archive = cached.archive;
      } else {
        const manifest = buildSkillManifest({
          name: normalizedName,
          description: values.description,
          instructions: values.instructions,
        });
        try {
          archive = buildSkillArchive(
            manifest,
            files
              .filter((node) => node.kind === SkillFileNodeKind.File)
              .map((node) => ({
                path: node.path,
                data:
                  filesContentRef.current.get(node.path) ?? new Uint8Array(0),
              })),
          );
        } catch {
          setSubmitError(t(SkillEditorI18nKeys.ErrorArchiveBuildFailed));
          return;
        }
      }

      setPhase('submitting');
      try {
        const listing = await listSkills({ bucket, path: '' });
        const conflict = listing.items?.some(
          (item) => item.name === normalizedName,
        );
        if (conflict) {
          setPhase('failure');
          setErrors({ name: t(SkillEditorI18nKeys.ErrorNameConflict) });
          return;
        }

        lastAttemptRef.current = { fingerprint, bucket, path, archive };

        await uploadSkill(bucket, path, archive);

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
      phase,
      bucket,
      files,
      t,
      showNotification,
      navigate,
      returnUrl,
      applyUploadErrorStatus,
    ],
  );

  const labels = useMemo<SkillEditorLabels>(
    () => ({
      filesHeading: t(SkillEditorI18nKeys.FilesHeading),
      filesTreeAriaLabel: t(SkillEditorI18nKeys.FilesTreeAriaLabel),
      addLabel: t(SkillEditorI18nKeys.AddLabel),
      addFileLabel: t(SkillEditorI18nKeys.AddFileLabel),
      addFolderLabel: t(SkillEditorI18nKeys.AddFolderLabel),
      addUploadLabel: t(SkillEditorI18nKeys.AddUploadLabel),
      newPathLabel: t(SkillEditorI18nKeys.NewPathLabel),
      newPathPlaceholder: t(SkillEditorI18nKeys.NewPathPlaceholder),
      removeLabel: t(SkillEditorI18nKeys.RemoveLabel),
      removeConfirmTitle: t(SkillEditorI18nKeys.RemoveConfirmTitle),
      removeConfirmMessage: (path) =>
        t(SkillEditorI18nKeys.RemoveConfirmMessage, { path }),
      removeConfirmLabel: t(SkillEditorI18nKeys.RemoveConfirmLabel),
      removeCancelLabel: t(SkillEditorI18nKeys.RemoveCancelLabel),
      editingFileLabel: t(SkillEditorI18nKeys.EditingFileLabel),
      nameLabel: t(SkillEditorI18nKeys.NameLabel),
      namePlaceholder: t(SkillEditorI18nKeys.NamePlaceholder),
      nameCaption: t(SkillEditorI18nKeys.NameCaption),
      descriptionLabel: t(SkillEditorI18nKeys.DescriptionLabel),
      descriptionPlaceholder: t(SkillEditorI18nKeys.DescriptionPlaceholder),
      instructionsLabel: t(SkillEditorI18nKeys.InstructionsLabel),
      instructionsPlaceholder: t(SkillEditorI18nKeys.InstructionsPlaceholder),
      createLabel: t(ButtonsI18nKeys.Create),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      retryLabel: t(ButtonsI18nKeys.Retry),
      loadErrorMessage: t(SkillEditorI18nKeys.LoadError),
      savingStatusLabel: t(SkillEditorI18nKeys.SavingStatus),
      loadingAriaLabel: t(SkillEditorI18nKeys.LoadingAriaLabel),
      supportingFileNote: t(SkillEditorI18nKeys.SupportingFileNote),
    }),
    [t],
  );

  if (!bucket) {
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
      >
        <h1 className="dial-h1-text">
          {t(SkillEditorI18nKeys.BucketMissingTitle)}
        </h1>
        <ErrorText text={t(SkillEditorI18nKeys.BucketMissingMessage)} />
        <PrimaryButton
          label={t(ButtonsI18nKeys.Cancel)}
          onClick={handleCancel}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-tertiary p-4 desktop:hidden">
        <GhostIconButton
          icon={
            <IconArrowLeft size={20} className="rtl:scale-x-[-1]" aria-hidden />
          }
          aria-label={t(SkillEditorI18nKeys.BackAriaLabel)}
          onClick={handleCancel}
        />
        <h1 className={mergeClasses('dial-h1-text')}>
          {t(SkillEditorI18nKeys.Title)}
        </h1>
      </div>
      <div className="min-h-0 flex-1">
        <SkillEditorForm
          files={files}
          isSubmitting={phase === 'submitting'}
          errors={errors}
          submitError={submitError}
          fileActions={fileActions}
          labels={labels}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          instructionsEditorTheme={
            currentTheme === ThemeId.Dark ? 'dark' : 'light'
          }
        />
      </div>
    </div>
  );
};

export default memo(SkillEditorPage);
