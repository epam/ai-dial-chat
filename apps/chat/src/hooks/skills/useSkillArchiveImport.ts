import type { SkillImportResponseDto } from '@epam/ai-dial-chat-api-client';
import {
  getApiErrorDetails,
  SkillArchiveImportErrorKind,
  SkillArchiveImportStatus,
  SkillArchiveSelectionRejectionReason,
  useSkillArchiveImport as useSkillArchiveImportController,
} from '@epam/ai-dial-chat-hooks';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SkillArchiveImportI18nKeys } from '../../constants/translation-keys';
import { useNotification } from '../../context/NotificationContext';
import { useSkills } from '../../context/SkillsContext';
import { importSkillArchive as requestSkillArchiveImport } from '../../server-api/skills.api';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { useOperationNotification } from '../useOperationNotification';

export { SkillArchiveImportStatus };

/*
 * Per `openspec/changes/archive/2026-08-20-add-skill-archive-import/design.md` (`add-skill-archive-import`): 400/413/422 are archive-content problems
 * (missing/invalid manifest, unsafe path, size limits), 409 is a name collision, 429 is rate
 * limiting, and 502/503 mean DIAL Core is unavailable. Anything else (401/403/network
 * failure/...) falls back to a generic message.
 */
const ERROR_I18N_KEYS: Record<
  SkillArchiveImportErrorKind,
  SkillArchiveImportI18nKeys
> = {
  [SkillArchiveImportErrorKind.Validation]:
    SkillArchiveImportI18nKeys.ErrorValidation,
  [SkillArchiveImportErrorKind.Collision]:
    SkillArchiveImportI18nKeys.ErrorCollision,
  [SkillArchiveImportErrorKind.RateLimited]:
    SkillArchiveImportI18nKeys.ErrorRateLimited,
  [SkillArchiveImportErrorKind.ServiceUnavailable]:
    SkillArchiveImportI18nKeys.ErrorServiceUnavailable,
  [SkillArchiveImportErrorKind.Generic]:
    SkillArchiveImportI18nKeys.ErrorGeneric,
};

interface UseSkillArchiveImportResult {
  /** Whether the "Upload skill" dialog is open. */
  isDialogOpen: boolean;
  /** Current phase of the import — drives loading/success/error UI. */
  status: SkillArchiveImportStatus;
  /** Localized status sentence for an `aria-live` region; `undefined` while idle. */
  statusMessage: string | undefined;
  /** Localized rejection message for the drop zone; `undefined` when nothing was rejected. */
  selectionError: string | undefined;
  /** Localized message for the drop zone — a local rejection or a failed import; `undefined` when there is none. */
  errorText: string | undefined;
  /** Whether an import request is in flight; the dialog stays open meanwhile. */
  isUploading: boolean;
  /** Opens the upload dialog, unless an import is already in flight. */
  openDialog: () => void;
  /** Closes the upload dialog, aborting an in-flight import, and clears any error. */
  closeDialog: () => void;
  /** Wire to the dialog drop zone's `onChange`. */
  handleFilesSelected: (files: File[]) => void;
  /** Wire to the dialog drop zone's `onReject`. */
  handleFilesRejected: () => void;
}

/**
 * Host adapter for the Catalog "Upload" action: configures the import request, raises the
 * "Skill created" notification, refreshes `SkillsContext`, and translates the library
 * controller's semantic status/error outcomes — keeping that whole workflow out of `CatalogView`
 * (`openspec/changes/archive/2026-08-20-add-skill-archive-import/design.md` D10, `add-skill-archive-import`).
 */
export const useSkillArchiveImport = (): UseSkillArchiveImportResult => {
  const { t } = useTranslation();
  const { refetchSkills } = useSkills();
  const { notifyOperationSuccess } = useOperationNotification();
  const { showErrorNotification } = useNotification();

  const onImported = useCallback(
    async (response: SkillImportResponseDto) => {
      notifyOperationSuccess(NotifiableEntity.Skill, EntityOperation.Created, {
        name: response.name,
      });
      await refetchSkills();
    },
    [notifyOperationSuccess, refetchSkills],
  );

  /*
   * Every failure is rendered inline in the still-open dialog. Only the unmapped/unexpected
   * case also raises a toast, since that is the one place the trace id is shown — the mapped
   * kinds (validation, collision, rate limit, service unavailable) already tell the user
   * exactly what happened.
   */
  const onError = useCallback(
    async (error: unknown, kind: SkillArchiveImportErrorKind) => {
      if (kind !== SkillArchiveImportErrorKind.Generic) return;

      const { traceId } = await getApiErrorDetails(error);
      showErrorNotification({
        title: t(SkillArchiveImportI18nKeys.ErrorTitle),
        message: t(ERROR_I18N_KEYS[kind]),
        requestId: traceId,
      });
    },
    [showErrorNotification, t],
  );

  const importArchive = useCallback(
    (file: File, signal: AbortSignal) =>
      requestSkillArchiveImport(file, signal),
    [],
  );

  const controller = useSkillArchiveImportController<SkillImportResponseDto>({
    importArchive,
    onImported,
    onError,
  });

  const statusMessage = useMemo(() => {
    if (
      controller.selectionRejectionReason ===
      SkillArchiveSelectionRejectionReason.UnsupportedFilename
    ) {
      return t(SkillArchiveImportI18nKeys.ErrorUnsupportedFilename);
    }

    switch (controller.status) {
      case SkillArchiveImportStatus.Uploading:
        return t(SkillArchiveImportI18nKeys.StatusUploading);
      case SkillArchiveImportStatus.Success:
        return t(SkillArchiveImportI18nKeys.StatusSuccess);
      case SkillArchiveImportStatus.Error:
        return controller.errorKind
          ? t(ERROR_I18N_KEYS[controller.errorKind])
          : undefined;
      default:
        return undefined;
    }
  }, [
    controller.status,
    controller.errorKind,
    controller.selectionRejectionReason,
    t,
  ]);

  const selectionError =
    controller.selectionRejectionReason ===
    SkillArchiveSelectionRejectionReason.UnsupportedFilename
      ? t(SkillArchiveImportI18nKeys.ErrorUnsupportedFilename)
      : undefined;

  const importError =
    controller.status === SkillArchiveImportStatus.Error && controller.errorKind
      ? t(ERROR_I18N_KEYS[controller.errorKind])
      : undefined;

  return {
    isDialogOpen: controller.isDialogOpen,
    status: controller.status,
    statusMessage,
    selectionError,
    errorText: selectionError ?? importError,
    isUploading: controller.isUploading,
    openDialog: controller.openDialog,
    closeDialog: controller.closeDialog,
    handleFilesSelected: controller.handleFilesSelected,
    handleFilesRejected: controller.handleFilesRejected,
  };
};
