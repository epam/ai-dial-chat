import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { BucketService } from '@/src/utils/app/data/bucket-service';
import { getRelativePath } from '@/src/utils/app/file';
import { isRootId } from '@/src/utils/app/id';
import {
  ResolvedUploadFile,
  detectUploadFileConflicts,
  dispatchPreparedFileUploads,
} from '@/src/utils/app/prepare-files-for-upload';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { Translation } from '@/src/types/translation';

import { FilesActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { UploadStatus } from '@epam/ai-dial-shared';

export interface DispatchPreparedFilesOptions {
  bucket?: string;
  showSuccessMessage?: boolean;
  isFromDeviceAttachment?: boolean;
}

export const useUploadFilesHandler = (
  folderId: string,
  selectedAttachmentsAmount = 0,
  maximumAttachmentsAmount = 0,
  allowedTypes: string[] = [],
  skipSelect?: boolean,
  preUploadFiles?: boolean,
) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const allFiles = useAppSelector(FilesSelectors.selectFiles);

  const { bucket } = useMemo(
    () =>
      folderId
        ? splitEntityId(folderId)
        : { bucket: BucketService.getBucket() },
    [folderId],
  );

  const folderPath = getRelativePath(folderId);
  const folderStatus = useAppSelector((state) =>
    FilesSelectors.selectFolderStatusById(state, folderId),
  );

  useEffect(() => {
    if (
      folderId &&
      !isRootId(folderId) &&
      preUploadFiles &&
      (!folderStatus || folderStatus === UploadStatus.UNINITIALIZED)
    ) {
      dispatch(FilesActions.getFiles({ id: folderId }));
    }
  }, [dispatch, folderId, folderStatus, preUploadFiles]);

  const dispatchPreparedFiles = useCallback(
    (
      preparedFiles: ResolvedUploadFile[],
      targetFolderPath: string | undefined = folderPath,
      options: DispatchPreparedFilesOptions = {},
    ) => {
      return dispatchPreparedFileUploads(
        dispatch,
        preparedFiles,
        targetFolderPath,
        {
          bucket: options.bucket ?? bucket,
          showSuccessMessage: options.showSuccessMessage ?? false,
          selectFileIds: !skipSelect,
          isFromDeviceAttachment: options.isFromDeviceAttachment ?? false,
        },
      );
    },
    [bucket, dispatch, folderPath, skipSelect],
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      const attachmentsAmount = selectedAttachmentsAmount + files.length;
      if (attachmentsAmount > maximumAttachmentsAmount) {
        dispatch(
          UIActions.showErrorToast({
            message: t(ChatI18nKeys.MaxAllowedAttachmentsNumber, {
              maxAttachmentsAmount: maximumAttachmentsAmount,
              attachmentsAmount,
            }),
          }),
        );
        return;
      }

      const { duplicatedFiles, nonDuplicatedFiles, errorMsg } =
        detectUploadFileConflicts({
          files,
          folderId,
          existingFiles: allFiles,
          bucket,
          allowedTypes,
        });

      if (errorMsg) dispatch(UIActions.showErrorToast({ message: errorMsg }));
      if (!duplicatedFiles.length && !nonDuplicatedFiles.length) return;

      if (duplicatedFiles.length) {
        dispatch(
          FilesActions.showUploadReplaceDialog({
            duplicatedFiles,
            nonDuplicatedFiles,
            folderId,
            folderPath,
            bucket,
            showSuccessMessage: true,
            selectFileIds: !skipSelect,
            isFromDeviceAttachment: true,
          }),
        );
        return Promise.resolve(nonDuplicatedFiles);
      }

      dispatchPreparedFiles(nonDuplicatedFiles, folderPath, {
        showSuccessMessage: true,
        isFromDeviceAttachment: true,
      });

      return Promise.resolve(nonDuplicatedFiles);
    },
    [
      selectedAttachmentsAmount,
      maximumAttachmentsAmount,
      allowedTypes,
      dispatch,
      allFiles,
      dispatchPreparedFiles,
      t,
      folderId,
      bucket,
      folderPath,
      skipSelect,
    ],
  );

  return { uploadFiles, dispatchPreparedFiles };
};
