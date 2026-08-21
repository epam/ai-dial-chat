import { ChangeEvent, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SkillArchiveImportI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useSkills } from '../../context/SkillsContext';
import {
  getApiErrorDetails,
  getApiErrorStatus,
} from '../../server-api/api-error';
import { importSkillArchive as requestSkillArchiveImport } from '../../server-api/skills.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { useOperationNotification } from '../useOperationNotification';

/** Required manifest filename, matching the BFF's exact, case-sensitive check. */
const SKILL_MANIFEST_FILE = 'SKILL.md';

/**
 * Client-side UX shortcut only — the BFF is the actual authority on what it
 * accepts. Flags a `.md`-named file that isn't exactly `SKILL.md` so the
 * picker can reject it locally instead of round-tripping to the server for
 * an outcome the client can already predict.
 */
const isUnsupportedMarkdownFilename = (fileName: string): boolean =>
  fileName.toLowerCase().endsWith('.md') && fileName !== SKILL_MANIFEST_FILE;

export enum SkillArchiveImportStatus {
  Idle = 'idle',
  Uploading = 'uploading',
  Success = 'success',
  Error = 'error',
}

/**
 * Maps a failed import's HTTP status to the message it should show, per
 * design.md (`add-skill-archive-import`): 400/413/422 are archive-content
 * problems (missing/invalid manifest, unsafe path, size limits), 409 is a
 * name collision, 429 is rate limiting, and 502/503 mean DIAL Core is
 * unavailable. Any other status (401/403/network failure/...) falls back to
 * a generic message.
 */
export const mapSkillArchiveImportErrorKey = (
  status: number | undefined,
): SkillArchiveImportI18nKeys => {
  switch (status) {
    case 400:
    case 413:
    case 422:
      return SkillArchiveImportI18nKeys.ErrorValidation;
    case 409:
      return SkillArchiveImportI18nKeys.ErrorCollision;
    case 429:
      return SkillArchiveImportI18nKeys.ErrorRateLimited;
    case 502:
    case 503:
      return SkillArchiveImportI18nKeys.ErrorServiceUnavailable;
    default:
      return SkillArchiveImportI18nKeys.ErrorGeneric;
  }
};

interface UseSkillArchiveImportResult {
  /** Attach to the hidden `<input type="file">` the Catalog's "Upload" action opens. */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Current phase of the import — drives loading/success/error UI. */
  status: SkillArchiveImportStatus;
  /** Localized status sentence for an `aria-live` region; `undefined` while idle. */
  statusMessage: string | undefined;
  /** Opens the file picker, unless an import is already in flight. */
  triggerFilePicker: () => void;
  /** Wire directly to the hidden input's `onChange`. */
  handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Owns the Catalog "Upload" action's whole workflow: opening the hidden file
 * picker, uploading the selected archive to `POST /api/v1/skills/import`,
 * raising the "Skill created" notification, and refreshing `SkillsContext`
 * so the new Skill appears without a manual reload — kept out of
 * `CatalogView` so that already-large component doesn't absorb a full async
 * workflow (design.md D10, `add-skill-archive-import`).
 */
export const useSkillArchiveImport = (): UseSkillArchiveImportResult => {
  const { t } = useTranslation();
  const { refetchSkills } = useSkills();
  const { notifyOperationSuccess } = useOperationNotification();
  const { showErrorNotification } = useNotification();

  const [status, setStatus] = useState<SkillArchiveImportStatus>(
    SkillArchiveImportStatus.Idle,
  );
  const [statusMessage, setStatusMessage] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingRef = useRef(false);

  const importArchive = useCallback(
    async (file: File) => {
      isUploadingRef.current = true;
      setStatus(SkillArchiveImportStatus.Uploading);
      setStatusMessage(t(SkillArchiveImportI18nKeys.StatusUploading));

      try {
        const response = await requestSkillArchiveImport(file);
        setStatus(SkillArchiveImportStatus.Success);
        setStatusMessage(t(SkillArchiveImportI18nKeys.StatusSuccess));
        notifyOperationSuccess(
          NotifiableEntity.Skill,
          EntityOperation.Created,
          {
            name: response.name,
          },
        );
        await refetchSkills();
      } catch (error) {
        setStatus(SkillArchiveImportStatus.Error);
        const errorStatus = getApiErrorStatus(error);
        const errorKey = mapSkillArchiveImportErrorKey(errorStatus);
        const message = t(errorKey);
        setStatusMessage(message);

        /* Trace ids are only meaningful for the unmapped/unexpected case —
         * the mapped statuses (validation, collision, rate limit, service
         * unavailable) already tell the user exactly what happened. */
        const requestId =
          errorKey === SkillArchiveImportI18nKeys.ErrorGeneric
            ? (await getApiErrorDetails(error)).traceId
            : undefined;

        showErrorNotification({
          title: t(SkillArchiveImportI18nKeys.ErrorTitle),
          message,
          requestId,
        });
      } finally {
        isUploadingRef.current = false;
      }
    },
    [notifyOperationSuccess, refetchSkills, showErrorNotification, t],
  );

  const triggerFilePicker = useCallback(() => {
    if (isUploadingRef.current) return;
    fileInputRef.current?.click();
  }, []);

  const rejectUnsupportedFilename = useCallback(() => {
    setStatus(SkillArchiveImportStatus.Error);
    const message = t(SkillArchiveImportI18nKeys.ErrorUnsupportedFilename);
    setStatusMessage(message);
    showErrorNotification({
      title: t(SkillArchiveImportI18nKeys.ErrorTitle),
      message,
    });
  }, [showErrorNotification, t]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      /* Reset so selecting the same file again re-triggers onChange. */
      event.target.value = '';
      if (!file) return;
      if (isUnsupportedMarkdownFilename(file.name)) {
        rejectUnsupportedFilename();
        return;
      }
      void importArchive(file);
    },
    [importArchive, rejectUnsupportedFilename],
  );

  return {
    fileInputRef,
    status,
    statusMessage,
    triggerFilePicker,
    handleFileChange,
  };
};
